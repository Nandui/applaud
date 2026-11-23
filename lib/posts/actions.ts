"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { canViewerSee } from "@/lib/posts/audience";
import { getCatalogue } from "@/lib/catalogue";
import { lookOf } from "@/lib/profile-custom";
import { shortTime, fullTimestamp } from "@/lib/datetime";
import type { FrameArt } from "@/lib/cosmetics";
import {
  ANSWER_MAX_LENGTH,
  POLL_DURATIONS,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  QUESTION_MAX_LENGTH,
  canCreatePollsAndQuestions,
} from "@/lib/posts/kinds";

export type PostActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** Picked sites must exist and be active; none picked = everyone. */
async function checkSites(
  siteIds: string[],
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const unique = [...new Set(siteIds)];
  if (unique.length === 0) return { ok: true, ids: [] };
  const found = await prisma.site.findMany({
    where: { id: { in: unique }, active: true },
    select: { id: true },
  });
  if (found.length !== unique.length) return { ok: false, error: "One of those sites no longer exists." };
  return { ok: true, ids: unique };
}

const NOT_ALLOWED = "Only managers, centre managers, operations managers and the CEO can do this.";

const pollSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Write the question.")
    .max(QUESTION_MAX_LENGTH, `Keep the question under ${QUESTION_MAX_LENGTH} characters.`),
  options: z
    .array(z.string().trim().max(POLL_OPTION_MAX_LENGTH, `Keep each choice under ${POLL_OPTION_MAX_LENGTH} characters.`))
    .transform((list) => list.filter((o) => o.length > 0))
    .refine((list) => list.length >= POLL_MIN_OPTIONS, `Add at least ${POLL_MIN_OPTIONS} choices.`)
    .refine((list) => list.length <= POLL_MAX_OPTIONS, `Up to ${POLL_MAX_OPTIONS} choices.`)
    .refine(
      (list) => new Set(list.map((o) => o.toLowerCase())).size === list.length,
      "Two choices are the same.",
    ),
  hours: z.coerce
    .number()
    .int()
    .refine((h) => POLL_DURATIONS.some((d) => d.hours === h), "Pick how long the poll runs."),
  showResults: z.boolean(),
  siteIds: z.array(z.string().min(1)).max(50),
});

/**
 * Post a poll to the feed. Only Manager, Centre manager, Operations manager
 * and CEO ranks (and admins) can. Everyone can vote, once, anonymously.
 */
export async function createPoll(
  _prev: PostActionResult | undefined,
  formData: FormData,
): Promise<PostActionResult> {
  const me = await requireUser();
  if (!canCreatePollsAndQuestions(me)) return { ok: false, error: NOT_ALLOWED };

  const parsed = pollSchema.safeParse({
    question: formData.get("message") ?? "",
    options: formData.getAll("options").map(String),
    hours: formData.get("hours") ?? "",
    showResults: formData.get("showResults") === "on",
    siteIds: formData.getAll("siteIds").map(String),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid poll." };
  }
  const { question, options, hours, showResults } = parsed.data;
  const sites = await checkSites(parsed.data.siteIds);
  if (!sites.ok) return sites;

  const poll = await prisma.recognition.create({
    data: {
      kind: "poll",
      senderId: me.id,
      message: question,
      imageUrls: [],
      visibility: "public",
      pollClosesAt: hours > 0 ? new Date(Date.now() + hours * 3_600_000) : null,
      pollShowResults: showResults,
      audienceSiteIds: sites.ids,
      pollOptions: { create: options.map((label, i) => ({ label, sortOrder: i })) },
    },
  });
  await writeAudit({
    actor: me,
    action: "poll.created",
    entityType: "recognition",
    entityId: poll.id,
    summary: `Asked a poll with ${options.length} choices`,
    metadata: { question, options, hours, showResults, siteIds: sites.ids },
    siteId: me.siteId,
  });
  revalidatePath("/");
  revalidatePath("/profile/[id]", "page");
  return { ok: true, message: "Poll posted" };
}

const questionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Write the question.")
    .max(QUESTION_MAX_LENGTH, `Keep the question under ${QUESTION_MAX_LENGTH} characters.`),
  siteIds: z.array(z.string().min(1)).max(50),
});

/**
 * Ask everyone a question. People answer privately: only the person who
 * asked can read the answers. Same creators as polls.
 */
export async function createQuestion(
  _prev: PostActionResult | undefined,
  formData: FormData,
): Promise<PostActionResult> {
  const me = await requireUser();
  if (!canCreatePollsAndQuestions(me)) return { ok: false, error: NOT_ALLOWED };

  const parsed = questionSchema.safeParse({
    question: formData.get("message") ?? "",
    siteIds: formData.getAll("siteIds").map(String),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid question." };
  }
  const sites = await checkSites(parsed.data.siteIds);
  if (!sites.ok) return sites;
  const q = await prisma.recognition.create({
    data: {
      kind: "question",
      senderId: me.id,
      message: parsed.data.question,
      imageUrls: [],
      visibility: "public",
      audienceSiteIds: sites.ids,
    },
  });
  await writeAudit({
    actor: me,
    action: "question.created",
    entityType: "recognition",
    entityId: q.id,
    summary: "Asked a question",
    metadata: { question: parsed.data.question, siteIds: sites.ids },
    siteId: me.siteId,
  });
  revalidatePath("/");
  revalidatePath("/profile/[id]", "page");
  return { ok: true, message: "Question posted" };
}

/**
 * Vote on a poll, or move your vote to another choice while it is open.
 * One vote per person (database unique on poll + person).
 */
export async function votePoll(pollId: string, optionId: string): Promise<PostActionResult> {
  const me = await requireUser();
  const option = await prisma.pollOption.findFirst({
    where: { id: optionId, recognitionId: pollId, recognition: { kind: "poll" } },
    select: { id: true, recognition: { select: { pollClosesAt: true } } },
  });
  if (!option || !(await canViewerSee(pollId, me.id))) {
    return { ok: false, error: "That poll no longer exists." };
  }
  const closesAt = option.recognition.pollClosesAt;
  if (closesAt && closesAt <= new Date()) return { ok: false, error: "This poll has closed." };

  await prisma.pollVote.upsert({
    where: { recognitionId_userId: { recognitionId: pollId, userId: me.id } },
    create: { recognitionId: pollId, optionId, userId: me.id },
    update: { optionId },
  });
  // No option in the audit log: votes are anonymous.
  await writeAudit({
    actor: me,
    action: "poll.voted",
    entityType: "recognition",
    entityId: pollId,
    summary: "Voted on a poll",
    siteId: me.siteId,
  });
  revalidatePath("/");
  revalidatePath("/profile/[id]", "page");
  return { ok: true };
}

const answerSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write your answer.")
    .max(ANSWER_MAX_LENGTH, `Keep it under ${ANSWER_MAX_LENGTH} characters.`),
});

/**
 * Answer a question privately, or change your answer. Only you and the
 * person who asked can ever read it.
 */
export async function answerQuestion(questionId: string, body: string): Promise<PostActionResult> {
  const me = await requireUser();
  const parsed = answerSchema.safeParse({ body });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid answer." };
  }
  const q = await prisma.recognition.findUnique({
    where: { id: questionId },
    select: { kind: true, senderId: true },
  });
  if (!q || q.kind !== "question" || !(await canViewerSee(questionId, me.id))) {
    return { ok: false, error: "That question no longer exists." };
  }
  if (q.senderId === me.id) return { ok: false, error: "You can't answer your own question." };

  await prisma.questionAnswer.upsert({
    where: { recognitionId_userId: { recognitionId: questionId, userId: me.id } },
    create: { recognitionId: questionId, userId: me.id, body: parsed.data.body },
    update: { body: parsed.data.body },
  });
  // The answer itself stays out of the audit log, which admins can read.
  await writeAudit({
    actor: me,
    action: "question.answered",
    entityType: "recognition",
    entityId: questionId,
    summary: "Answered a question privately",
    siteId: me.siteId,
  });
  revalidatePath("/");
  revalidatePath("/profile/[id]", "page");
  return { ok: true };
}

export type QuestionAnswerView = {
  id: string;
  body: string;
  createdAtLabel: string;
  createdAtFull: string;
  edited: boolean;
  user: { id: string; name: string; avatarUrl: string | null; jobTitle: string | null; frame: FrameArt | null };
};

/**
 * Every answer to a question, newest first. Only the person who asked can
 * read them: nobody else, not even admins.
 */
export async function getQuestionAnswers(
  questionId: string,
): Promise<{ ok: true; answers: QuestionAnswerView[] } | { ok: false; error: string }> {
  const me = await requireUser();
  const q = await prisma.recognition.findUnique({
    where: { id: questionId },
    select: { kind: true, senderId: true },
  });
  if (!q || q.kind !== "question") return { ok: false, error: "That question no longer exists." };
  if (q.senderId !== me.id) return { ok: false, error: "Only the person who asked can see the answers." };

  const [rows, catalogue] = await Promise.all([
    prisma.questionAnswer.findMany({
      where: { recognitionId: questionId },
      orderBy: { updatedAt: "desc" },
      include: { user: { select: { id: true, name: true, avatarUrl: true, jobTitle: true, profile: true } } },
    }),
    getCatalogue(),
  ]);
  return {
    ok: true,
    answers: rows.map((a) => ({
      id: a.id,
      body: a.body,
      createdAtLabel: shortTime(a.updatedAt),
      createdAtFull: fullTimestamp(a.updatedAt),
      edited: a.updatedAt.getTime() - a.createdAt.getTime() > 1000,
      user: {
        id: a.user.id,
        name: a.user.name,
        avatarUrl: a.user.avatarUrl,
        jobTitle: a.user.jobTitle,
        frame: lookOf(a.user.profile, catalogue).frame,
      },
    })),
  };
}
