import {
  adminSupabase,
  authenticatedUser,
  ensureCampaignTopic,
  json,
  visitorIdentity,
} from "../../topicServer";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const user = await authenticatedUser(request);
    if (!user) return json({ error: "Authentication required" }, 401);

    const client = adminSupabase();
    const topic = await ensureCampaignTopic(slug);
    if (!topic) return json({ error: "Topic not found" }, 404);
    const identity = await visitorIdentity(request);

    const { data: guest, error: guestError } = await client
      .from("campaign_topic_guest_responses")
      .select("id, body, claimed_post_id")
      .eq("topic_id", topic.id)
      .eq("visitor_hash", identity.visitorHash)
      .maybeSingle();
    if (guestError) throw guestError;
    if (!guest) return json({ claimed: false }, 200, identity.cookie);
    if (guest.claimed_post_id) return json({ claimed: true, post_id: guest.claimed_post_id }, 200, identity.cookie);

    const { count: existingPostCount, error: countError } = await client
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id);
    if (countError) throw countError;
    const postId = String(Date.now());
    const fallback = await client
      .from("campaign_topics")
      .select("room_name, room_slug, media_url")
      .eq("id", topic.id)
      .single();
    if (fallback.error) throw fallback.error;

    const { error: postError } = await client.from("posts").insert({
      id: postId,
      author_id: user.id,
      body: guest.body,
      tags: [fallback.data.room_name, fallback.data.room_slug, "bantrbox", `topic:${slug}`],
      topic_id: topic.id,
      media_url: fallback.data.media_url,
      visibility: "Everyone",
    });
    if (postError) throw postError;

    const { data: claimedRows, error: claimError } = await client
      .from("campaign_topic_guest_responses")
      .update({ claimed_by: user.id, claimed_post_id: postId, claimed_at: new Date().toISOString() })
      .eq("id", guest.id)
      .is("claimed_post_id", null)
      .select("claimed_post_id");
    if (claimError || !claimedRows?.length) {
      await client.from("posts").delete().eq("id", postId).eq("author_id", user.id);
      if (claimError) throw claimError;

      const { data: alreadyClaimed } = await client
        .from("campaign_topic_guest_responses")
        .select("claimed_post_id")
        .eq("id", guest.id)
        .maybeSingle();
      return json({
        claimed: Boolean(alreadyClaimed?.claimed_post_id),
        post_id: alreadyClaimed?.claimed_post_id || null,
      }, 200, identity.cookie);
    }

    return json({ claimed: true, post_id: postId, was_first_post: (existingPostCount || 0) === 0 }, 200, identity.cookie);
  } catch (error) {
    console.warn("Guest topic claim failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Your earlier take could not be linked yet." }, 503);
  }
}
