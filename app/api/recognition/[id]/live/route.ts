import { getCurrentUser } from "@/lib/auth/current-user";
import { canSeeRecognition, commentsAfter, setTyping, typingOn } from "@/lib/recognition/live";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * Live comments for one post: the comments after `?after=<commentId>` and who
 * is typing. The feed card polls this while it is on screen.
 */
export async function GET(request: Request, { params }: Context) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  if (!(await canSeeRecognition(id, me.id))) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  const after = new URL(request.url).searchParams.get("after") || null;
  const [comments, typing] = await Promise.all([commentsAfter(id, after), typingOn(id, me.id)]);
  return Response.json(
    { comments, typing },
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
