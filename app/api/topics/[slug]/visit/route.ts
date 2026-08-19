import { adminSupabase, json, visitorIdentity } from "../../topicServer";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { session_id: sessionId } = await request.json() as { session_id?: string };
    if (!sessionId || sessionId.length > 120) return json({ error: "Invalid visit session" }, 400);

    const client = adminSupabase();
    const { data: topic } = await client.from("campaign_topics").select("id").eq("slug", slug).maybeSingle();
    if (!topic) return json({ error: "Topic not found" }, 404);

    const identity = await visitorIdentity(request);
    const { count } = await client
      .from("campaign_topic_visits")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topic.id)
      .eq("visitor_hash", identity.visitorHash)
      .neq("session_id", sessionId);

    await client.from("campaign_topic_visits").upsert(
      {
        topic_id: topic.id,
        visitor_hash: identity.visitorHash,
        session_id: sessionId,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "topic_id,visitor_hash,session_id" }
    );

    return json({ return_visitor: (count || 0) > 0 }, 200, identity.cookie);
  } catch (error) {
    console.warn("Topic visit failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Visit could not be recorded" }, 503);
  }
}
