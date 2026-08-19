export type CampaignTopic = {
  id: string;
  slug: string;
  campaign_name: string;
  question: string;
  room_name: string;
  room_slug: string;
  media_url: string | null;
  status: "draft" | "scheduled" | "live" | "paused" | "expired";
  starts_at: string;
  expires_at: string;
  redirect_path: string;
};

export type TopicResponse = {
  id: string;
  author_id: string;
  body: string;
  media_url: string | null;
  created_at: string;
  profiles: {
    handle: string | null;
    display_name: string | null;
    avatar: string | null;
  } | null;
};

export const coachedTechniqueTopic: CampaignTopic = {
  id: "a11b1ac5-c0ac-4e5a-9e42-202608190001",
  slug: "all-blacks-coaching-approved",
  campaign_name: "All Blacks coaching: approved?",
  question: "Did the All Black coaches approve:\n1) Tucked shoulder & reversed-arm non-wrapping hits?\n2) Illegal maul defence by pulling or trying to lift attackers leg or going off feet?\n\nDrop your take!",
  room_name: "Springboks vs All Blacks",
  room_slug: "springboksvsallblacks",
  media_url: "/brand/bantrboks-coached-technique-comment-now-1080x1080.gif",
  status: "live",
  starts_at: "2026-08-18T22:00:00.000Z",
  expires_at: "2026-08-23T15:00:00.000Z",
  redirect_path: "/#home",
};

