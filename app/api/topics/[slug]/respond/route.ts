import {
  actorHash,
  adminSupabase,
  ensureCampaignTopic,
  enforceRateLimit,
  json,
  visitorIdentity,
} from "../../topicServer";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const payload = await request.json() as { body?: string };
    const body = String(payload.body || "").trim();
    if (!body || body.length > 280) return json({ error: "Write a take of up to 280 characters." }, 400);

    const client = adminSupabase();
    const topic = await ensureCampaignTopic(slug);
    if (!topic) return json({ error: "Topic not found" }, 404);

    const identity = await visitorIdentity(request);
    const { count: visitCount, error: visitError } = await client
      .from("campaign_topic_visits")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topic.id)
      .eq("visitor_hash", identity.visitorHash);
    if (visitError) throw visitError;
    if ((visitCount || 0) > 1) return json({ registration_required: true }, 401, identity.cookie);

    const actor = await actorHash(request, identity.visitorHash);
    if (!await enforceRateLimit(topic.id, actor, "guest_response", 5)) {
      return json({ error: "Too many attempts. Try again later." }, 429, identity.cookie);
    }

    const { data: existing } = await client
      .from("campaign_topic_guest_responses")
      .select("id")
      .eq("topic_id", topic.id)
      .eq("visitor_hash", identity.visitorHash)
      .maybeSingle();
    if (existing) return json({ registration_required: true }, 401, identity.cookie);

    const { data, error } = await client
      .from("campaign_topic_guest_responses")
      .insert({ topic_id: topic.id, visitor_hash: identity.visitorHash, body })
      .select("id, body, created_at")
      .single();
    if (error) throw error;

    return json({
      response: {
        id: `guest:${data.id}`,
        guest_response_id: data.id,
        author_id: "guest",
        body: data.body,
        media_url: null,
        created_at: data.created_at,
        profiles: null,
      },
    }, 201, identity.cookie);
  } catch (error) {
    console.warn("Guest topic response failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Your take could not be saved." }, 503);
  }
}
