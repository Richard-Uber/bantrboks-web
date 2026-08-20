import {
  actorHash,
  adminSupabase,
  authenticatedUser,
  ensureCampaignTopic,
  enforceRateLimit,
  json,
  visitorIdentity,
} from "../../topicServer";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const payload = await request.json() as {
      target_key?: string;
      reaction?: "slap" | "fire";
    };
    if (!payload.target_key || !["slap", "fire"].includes(payload.reaction || "")) {
      return json({ error: "Invalid reaction" }, 400);
    }

    const client = adminSupabase();
    const topic = await ensureCampaignTopic(slug);
    if (!topic) return json({ error: "Topic not found" }, 404);

    const topicTarget = `topic:${topic.id}`;
    if (payload.target_key !== topicTarget) {
      const postId = payload.target_key.startsWith("post:") ? payload.target_key.slice(5) : "";
      if (!postId) return json({ error: "Invalid reaction target" }, 400);
      const { data: post } = await client
        .from("posts")
        .select("id")
        .eq("id", postId)
        .eq("topic_id", topic.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (!post) return json({ error: "Reaction target not found" }, 404);
    }

    const identity = await visitorIdentity(request);
    const user = await authenticatedUser(request);
    const { count: visitCount, error: visitCountError } = await client
      .from("campaign_topic_visits")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topic.id)
      .eq("visitor_hash", identity.visitorHash);
    if (visitCountError) throw visitCountError;
    if ((visitCount || 0) > 1 && !user) {
      return json({ registration_required: true }, 401, identity.cookie);
    }

    const actor = await actorHash(request, identity.visitorHash);
    if (!await enforceRateLimit(topic.id, actor, "reaction")) {
      return json({ error: "Too many reactions. Try again later." }, 429, identity.cookie);
    }

    const { error: reactionError } = await client.from("campaign_topic_reactions").upsert(
      {
        topic_id: topic.id,
        target_key: payload.target_key,
        visitor_hash: user ? `user:${user.id}` : identity.visitorHash,
        user_id: user?.id || null,
        reaction: payload.reaction,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "topic_id,target_key,visitor_hash" }
    );
    if (reactionError) throw reactionError;

    const { data: totals } = await client
      .from("campaign_topic_reactions")
      .select("reaction")
      .eq("topic_id", topic.id)
      .eq("target_key", payload.target_key);
    return json({
      totals: {
        slap: (totals || []).filter((item) => item.reaction === "slap").length,
        fire: (totals || []).filter((item) => item.reaction === "fire").length,
      },
    }, 200, identity.cookie);
  } catch (error) {
    console.warn("Topic reaction failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Reaction could not be saved" }, 503);
  }
}
