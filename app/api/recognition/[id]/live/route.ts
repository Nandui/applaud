import { getCurrentUser } from "@/lib/auth/current-user";
import {
  canSeeRecognition,
  commentReactionsOn,
  commentsAfter,
  setTyping,
  typingOn,
} from "@/lib/recognition/live";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * Live comments for one post: the comments after `?after=<commentId>` (with
 * replies among them) and who is typing. With `?reactions=1` (the comments
 * sheet is open) also every comment's reactions. The feed card polls this
 * while it is on screen.
 */
export async function GET(request: Request, { params }: Context) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  if (!(await canSeeRecognition(id, me.id))) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  const search = new URL(request.url).searchParams;
  const after = search.get("after") || null;
  const [comments, typing, reactions] = await Promise.all([
    commentsAfter(id, after, me.id),
    typingOn(id, me.id),
    search.get("reactions") === "1" ? commentReactionsOn(id, me.id) : null,
  ]);
  return Response.json(
    { comments, typing, reactions },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** `{ "typing": true }` while the viewer writes a comment, `false` when they stop. */
export async function POST(request: Request, { params }: Context) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { typing?: unknown } | null;
  const typing = body?.typing === true;
  if (typing && !(await canSeeRecognition(id, me.id))) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  await setTyping(id, me.id, typing);
  return new Response(null, { status: 204 });
}
