import type { Metadata } from "next";
import { ensureCampaignTopic } from "../../api/topics/topicServer";
import { supabase } from "../../supabase";
import { fallbackCampaignTopics, type CampaignTopic, type TopicResponse } from "../topicTypes";
import { TopicLanding } from "./TopicLanding";

async function loadTopic(slug: string) {
  const { data } = await supabase
    .from("campaign_topics")
    .select("id, slug, campaign_name, question, room_name, room_slug, media_url, status, starts_at, expires_at, redirect_path")
    .eq("slug", slug)
    .maybeSingle();
  if (data) return data as CampaignTopic;
  const fallback = fallbackCampaignTopics.find((topic) => topic.slug === slug) || null;
  if (fallback) await ensureCampaignTopic(slug);
  return fallback;
}

async function loadResponses(topicId: string) {
  const { data } = await supabase
    .from("posts")
    .select("id, author_id, body, media_url, created_at, profiles(handle, display_name, avatar)")
    .eq("topic_id", topicId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);
  return (data || []) as unknown as TopicResponse[];
}

async function loadReactionTotals(topicId: string) {
  const { data } = await supabase
    .from("campaign_topic_reactions")
    .select("target_key, reaction")
    .eq("topic_id", topicId);
  const totals: Record<string, { slap: number; fire: number }> = {};
  for (const item of data || []) {
    totals[item.target_key] ||= { slap: 0, fire: 0 };
    if (item.reaction === "slap" || item.reaction === "fire") {
      const reaction = item.reaction as "slap" | "fire";
      totals[item.target_key][reaction] += 1;
    }
  }
  return totals;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const topic = await loadTopic(slug);
  if (!topic) return { title: "Bantrboks topic" };
  const canonical = `/topic/${encodeURIComponent(topic.slug)}`;
  const description = topic.question.replace(/\s+/g, " ").slice(0, 190);
  return {
    title: topic.campaign_name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      siteName: "Bantrboks",
      title: topic.campaign_name,
      description,
      images: topic.media_url ? [{ url: topic.media_url, width: 1080, height: 1080 }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: topic.campaign_name,
      description,
      images: topic.media_url ? [topic.media_url] : [],
    },
  };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = await loadTopic(slug);
  if (!topic) {
    return <main className="topic-missing"><h1>That topic is no longer available.</h1><a href="/">Open Bantrboks</a></main>;
  }
  const [responses, totals] = await Promise.all([
    loadResponses(topic.id),
    loadReactionTotals(topic.id),
  ]);
  return <TopicLanding initialTopic={topic} initialResponses={responses} initialTotals={totals} />;
}
