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
  guest_response_id?: string;
  author_id: string;
  body: string;
  media_url: string | null;
  created_at: string;
  profiles: {
    handle: string | null;
    display_name: string | null;
    avatar: string | null;
  } | null;
  replies?: TopicReply[];
};

export type TopicReply = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
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

export const hakaGestureTopic: CampaignTopic = {
  id: "e55f5e09-a4e0-419e-b286-202608200004",
  slug: "haka-gesture-normal-or-not",
  campaign_name: "Still look normal?",
  question: "World wide, if it walks like a duck and talks like a duck, it is probably a duck! Apparently not in NZ?",
  room_name: "Springboks vs All Blacks",
  room_slug: "springboksvsallblacks",
  media_url: "/brand/bantrboks-haka-gesture-everyday-life-v2-1080x1080.png",
  status: "live",
  starts_at: "2026-08-20T10:04:45.000Z",
  expires_at: "2026-09-10T10:04:45.000Z",
  redirect_path: "/#home",
};

export const deAllende100thTopic: CampaignTopic = {
  id: "f66a6f1a-b5f1-42af-c397-202608200005",
  slug: "springboks-all-blacks-de-allende-100th",
  campaign_name: "Who wins this epic Test match?",
  question: "Who wins this epic Test match?\n\nDamian de Allende earns his 100th Test cap. Drop your prediction and take!",
  room_name: "Springboks vs All Blacks",
  room_slug: "springboksvsallblacks",
  media_url: "/brand/bantrboks-epic-test-de-allende-100th-1080x1080.png",
  status: "live",
  starts_at: "2026-08-20T12:00:00.000Z",
  expires_at: "2026-08-22T15:00:00.000Z",
  redirect_path: "/#home",
};

export const suzi95ConspiracyTopic: CampaignTopic = {
  id: "a77b7a2b-c6a2-43b0-d4a8-202608210003",
  slug: "famous-conspiracies-suzi-95",
  campaign_name: "Which conspiracy still divides rugby fans?",
  question: "Moon landing. Area 51. Chemtrails. Suzi '95.\n\nWas the 1995 food-poisoning accusation plausible—or has it become rugby folklore? Give your take!",
  room_name: "Springboks vs All Blacks",
  room_slug: "springboksvsallblacks",
  media_url: "/brand/bantrboks-famous-conspiracies-suzi-95-1080x1080.png",
  status: "live",
  starts_at: "2026-08-21T04:23:00.000Z",
  expires_at: "2026-09-21T04:23:00.000Z",
  redirect_path: "/#home",
};

export const allBlackConspiracyFilesTopic: CampaignTopic = {
  id: "b88c8b3c-d7b3-44c1-e5b9-202608210004",
  slug: "all-black-conspiracy-files",
  campaign_name: "The All Black conspiracy files",
  question: "1987. 1995. 2009. 2011.\n\nPattern or paranoia? Which All Black conspiracy theory still gets rugby fans arguing? Give your take!",
  room_name: "Springboks vs All Blacks",
  room_slug: "springboksvsallblacks",
  media_url: "/brand/bantrboks-all-black-conspiracy-files-1080x1080.png",
  status: "live",
  starts_at: "2026-08-21T11:40:00.000Z",
  expires_at: "2026-09-21T11:40:00.000Z",
  redirect_path: "/#home",
};

export const hakaExpertSingingTopic: CampaignTopic = {
  id: "c99d9c4d-e8c4-45d2-f6ca-202608210005",
  slug: "haka-expert-singing-is-an-honour",
  campaign_name: "Haka expert: singing back is beautiful",
  question: "For opponents to accept the haka challenge and respond in song is an honour.\n\nDoes staying silent show respect—or refuse the challenge? Give your take!",
  room_name: "Springboks vs All Blacks",
  room_slug: "springboksvsallblacks",
  media_url: "/brand/bantrboks-haka-expert-singing-is-an-honour-1080x1080.png",
  status: "live",
  starts_at: "2026-08-21T12:55:00.000Z",
  expires_at: "2026-09-21T12:55:00.000Z",
  redirect_path: "/#home",
};

export const fallbackCampaignTopics: CampaignTopic[] = [
  coachedTechniqueTopic,
  quickTapTopic,
  hakaResponseTopic,
  rivalryTrophyTopic,
  hakaGestureTopic,
  deAllende100thTopic,
  suzi95ConspiracyTopic,
  allBlackConspiracyFilesTopic,
  hakaExpertSingingTopic,
];
