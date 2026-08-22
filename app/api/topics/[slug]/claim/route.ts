import {
  adminSupabase,
  authenticatedUser,
  ensureCampaignTopic,
  ensureCanonicalTopicPost,
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
      .select("id, body, claimed_post_id, claimed_comment_id")
      .eq("topic_id", topic.id)
      .eq("visitor_hash", identity.visitorHash)
      .maybeSingle();
    if (guestError) throw guestError;
    if (!guest) return json({ claimed: false }, 200, identity.cookie);
    if (guest.claimed_comment_id && guest.claimed_post_id) return json({ claimed: true, post_id: guest.claimed_post_id }, 200, identity.cookie);

    const [postCount, commentCount] = await Promise.all([
      client.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
      client.from("comments").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    ]);
    if (postCount.error) throw postCount.error;
    if (commentCount.error) throw commentCount.error;
    const postId = await ensureCanonicalTopicPost(topic, user.id);
    const commentId = `${Date.now()}-${guest.id}`;
    const { error: commentError } = await client.from("comments").insert({
      id: commentId,
      post_id: postId,
      author_id: user.id,
      body: guest.body,
    });
    if (commentError) throw commentError;

    const { data: claimedRows, error: claimError } = await client
      .from("campaign_topic_guest_responses")
      .update({ claimed_by: user.id, claimed_post_id: postId, claimed_comment_id: commentId, claimed_at: new Date().toISOString() })
      .eq("id", guest.id)
      .is("claimed_comment_id", null)
      .select("claimed_post_id");
    if (claimError || !claimedRows?.length) {
      await client.from("comments").delete().eq("id", commentId).eq("author_id", user.id);
      if (claimError) throw claimError;

      const { data: alreadyClaimed } = await client
        .from("campaign_topic_guest_responses")
        .select("claimed_post_id, claimed_comment_id")
        .eq("id", guest.id)
        .maybeSingle();
      return json({
        claimed: Boolean(alreadyClaimed?.claimed_comment_id),
        post_id: alreadyClaimed?.claimed_post_id || null,
      }, 200, identity.cookie);
    }

    return json({
      claimed: true,
      post_id: postId,
      was_first_post: (postCount.count || 0) + (commentCount.count || 0) === 0,
    }, 200, identity.cookie);
  } catch (error) {
    console.warn("Guest topic claim failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Your earlier take could not be linked yet." }, 503);
  }
}
