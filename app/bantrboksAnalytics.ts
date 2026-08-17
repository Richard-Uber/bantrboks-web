"use client";

export type BantrboksEventName =
  | "room_view"
  | "choose_side"
  | "post_attempt"
  | "sign_up"
  | "first_post"
  | "reply_created"
  | "reaction_added"
  | "post_shared";

type EventValue = string | number | boolean | null | undefined;

export type BantrboksEventParameters = {
  side?: "springboks" | "all_blacks";
  post_id?: string;
  share_channel?: "native" | "whatsapp" | "facebook" | "x" | "instagram" | "copy_link";
  event_id?: string;
  [key: string]: EventValue;
};

type CampaignAttribution = {
  campaign_source?: string;
  campaign_name?: string;
  creative_id?: string;
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, EventValue>>;
  }
}

const attributionStorageKey = "bantrboks_campaign_attribution";

function createEventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `bb-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function readCampaignAttribution(): CampaignAttribution {
  if (typeof window === "undefined") return {};

  let saved: CampaignAttribution = {};
  try {
    saved = JSON.parse(window.localStorage.getItem(attributionStorageKey) || "{}") as CampaignAttribution;
  } catch {
    // Ignore malformed legacy attribution data and replace it when UTMs are present.
  }

  const query = new URLSearchParams(window.location.search);
  const current: CampaignAttribution = {
    campaign_source: query.get("utm_source") || undefined,
    campaign_name: query.get("utm_campaign") || undefined,
    creative_id: query.get("utm_content") || undefined,
  };
  const hasCurrentAttribution = Object.values(current).some(Boolean);

  if (hasCurrentAttribution) {
    saved = { ...saved, ...current };
    try {
      window.localStorage.setItem(attributionStorageKey, JSON.stringify(saved));
    } catch {
      // Analytics must never interfere with the product flow.
    }
  }

  return saved;
}

export function captureBantrboksCampaignAttribution() {
  readCampaignAttribution();
}

export function pushBantrboksEvent(
  event: BantrboksEventName,
  parameters: BantrboksEventParameters = {}
) {
  if (typeof window === "undefined") return "";

  const eventId = parameters.event_id || createEventId();
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...readCampaignAttribution(),
    ...parameters,
    event_id: eventId,
  });
  return eventId;
}

export function pushBantrboksEventOncePerAccount(
  event: "sign_up" | "first_post",
  accountId: string,
  parameters: BantrboksEventParameters = {}
) {
  if (typeof window === "undefined" || !accountId) return "";

  const storageKey = `bantrboks_event:${event}:${accountId}`;
  let existingEventId = "";
  try {
    existingEventId = window.localStorage.getItem(storageKey) || "";
  } catch {
    // The database checks remain authoritative when browser storage is unavailable.
  }
  if (existingEventId) return existingEventId;

  const eventId = parameters.event_id || createEventId();
  try {
    window.localStorage.setItem(storageKey, eventId);
  } catch {
    // Continue tracking if storage is unavailable; the database check protects first_post.
  }

  return pushBantrboksEvent(event, { ...parameters, event_id: eventId });
}
