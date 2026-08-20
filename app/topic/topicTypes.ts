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

export const quickTapTopic: CampaignTopic = {
  id: "b22c2bd6-d1bd-4f6b-af53-202608200001",
  slug: "nz-quick-tap-cheat-code-or-legit",
  campaign_name: "NZ quick tap: cheat code or legit?",
  question: "This is a NZ rugby tactic, elsewhere its called cheating right?\n\n“Take a big hit, stay down, then take the quick tap”",
  room_name: "Springboks vs All Blacks",
  room_slug: "springboksvsallblacks",
  media_url: "/brand/bantrboks-nz-quick-tap-debate-1080x1080.png",
  status: "live",
  starts_at: "2026-08-19T22:00:00.000Z",
  expires_at: "2026-08-23T15:00:00.000Z",
  redirect_path: "/#home",
};

export const hakaResponseTopic: CampaignTopic = {
  id: "c33d3ce7-e2ce-4f7c-b064-202608200002",
  slug: "staying-silent-haka-deserves-response",
  campaign_name: "The haka deserves a response",
  question: "Staying silent is disrespectful! The haka deserves a response!",
  room_name: "Springboks vs All Blacks",
  room_slug: "springboksvsallblacks",
  media_url: "/brand/bantrboks-responding-to-haka-singing-fact-v4-1080x1080.png",
  status: "live",
  starts_at: "2026-08-20T06:23:00.000Z",
  expires_at: "2026-09-10T06:23:00.000Z",
  redirect_path: "/#home",
};

export const rivalryTrophyTopic: CampaignTopic = {
  id: "d44e4df8-f3df-408d-a175-202608200003",
  slug: "rugby-greatest-rivalry-trophy-named",
  campaign_name: "Rugby's Greatest Rivalry trophy named!",
  question: "Rugby's Greatest Rivalry trophy named!",
  room_name: "Springboks vs All Blacks",
  room_slug: "springboksvsallblacks",
  media_url: "/brand/bantrboks-bill-and-suzi-trophies-v2-1080x1080.png",
  status: "live",
  starts_at: "2026-08-20T07:20:00.000Z",
  expires_at: "2026-09-10T07:20:00.000Z",
  redirect_path: "/#home",
};

export const fallbackCampaignTopics: CampaignTopic[] = [
  coachedTechniqueTopic,
  quickTapTopic,
  hakaResponseTopic,
  rivalryTrophyTopic,
];
