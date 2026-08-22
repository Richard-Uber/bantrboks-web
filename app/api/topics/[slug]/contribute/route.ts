import { adminSupabase, authenticatedUser, ensureCampaignTopic, ensureCanonicalTopicPost, json } from "../../topicServer";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const user = await authenticatedUser(request);
    if (!user) return json({ error: "Authentication required" }, 401);
    const payload = await request.json().catch(() => ({}));
    const body = typeof payload.body === "string" ? payload.body.trim().slice(0, 280) : "";
    if (!body) return json({ error: "Write your take first." }, 400);

    const topic = await ensureCampaignTopic(slug);
    if (!topic) return json({ error: "Topic not found" }, 404);
    const client = adminSupabase();
    const [postCount, commentCount] = await Promise.all([
      client.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
      client.from("comments").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    ]);
    if (postCount.error) throw postCount.error;
    if (commentCount.error) throw commentCount.error;
    const postId = await ensureCanonicalTopicPost(topic, user.id);
    const commentId = `${Date.now()}-${crypto.randomUUID()}`;
    const { data: comment, error } = await client.from("comments").insert({
      id: commentId,
      post_id: postId,
      author_id: user.id,
      body,
    }).select("id, post_id, author_id, body, created_at").single();
    if (error) throw error;
    const { data: profile } = await client.from("profiles").select("handle, display_name, avatar").eq("id", user.id).maybeSingle();
    return json({
      post_id: postId,
      comment: { ...comment, profiles: profile || null },
      was_first_post: (postCount.count || 0) + (commentCount.count || 0) === 0,
    });
  } catch (error) {
    console.warn("Topic contribution failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Your take could not be posted." }, 503);
  }
}
