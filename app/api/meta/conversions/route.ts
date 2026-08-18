import { isIP } from "node:net";

export const runtime = "nodejs";

const defaultDatasetId = "1451775146763668";
const defaultGraphApiVersion = "v25.0";
const maxRequestBytes = 4096;
const metaRequestTimeoutMs = 4500;

const eventNames = {
  sign_up: "CompleteRegistration",
  first_post: "FirstPost",
} as const;

type TrackedEvent = keyof typeof eventNames;

type ConversionRequest = {
  event?: unknown;
  event_id?: unknown;
  event_time?: unknown;
  event_source_url?: unknown;
};

let warnedAboutMissingConfiguration = false;

function configuredValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || "";
}

function graphApiVersion() {
  const configured = configuredValue(process.env.META_GRAPH_API_VERSION);
  return /^v\d+\.\d+$/.test(configured) ? configured : defaultGraphApiVersion;
}

function datasetId() {
  const configured = configuredValue(process.env.META_DATASET_ID);
  return /^\d+$/.test(configured) ? configured : defaultDatasetId;
}

function requestHostname(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || new URL(request.url).host;
  return host.toLowerCase();
}

function sameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).host.toLowerCase() === requestHostname(request);
  } catch {
    return false;
  }
}

function safeSourceUrl(value: unknown, request: Request) {
  const candidates = [
    typeof value === "string" ? value : "",
    request.headers.get("referer") || "",
    request.headers.get("origin") || "",
  ];
  const expectedHost = requestHostname(request);

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (
        (url.protocol === "https:" || url.protocol === "http:") &&
        url.host.toLowerCase() === expectedHost
      ) {
        url.username = "";
        url.password = "";
        // Query strings can contain referral tokens or user-supplied data. The
        // page path is sufficient for Meta's event_source_url matching.
        url.search = "";
        url.hash = "";
        return url.href;
      }
    } catch {
      // Try the next server-observed candidate.
    }
  }

  return null;
}

function eventTime(value: unknown) {
  const now = Math.floor(Date.now() / 1000);
  const parsed = typeof value === "number" ? Math.floor(value) : Number.NaN;
  const sevenDays = 7 * 24 * 60 * 60;

  if (Number.isFinite(parsed) && parsed >= now - sevenDays && parsed <= now + 60) {
    return parsed;
  }

  return now;
}

function eventId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9._:-]{8,128}$/.test(trimmed) ? trimmed : null;
}

function clientIpAddress(request: Request) {
  const candidates = [
    request.headers.get("cf-connecting-ip") || "",
    request.headers.get("x-real-ip") || "",
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
  ];

  return candidates.find((candidate) => isIP(candidate) !== 0) || undefined;
}

function cookieValue(request: Request, name: "_fbp" | "_fbc") {
  const cookieHeader = request.headers.get("cookie") || "";
  const encodedName = `${name}=`;

  for (const part of cookieHeader.split(";")) {
    const cookie = part.trim();
    if (!cookie.startsWith(encodedName)) continue;

    let value = cookie.slice(encodedName.length);
    try {
      value = decodeURIComponent(value);
    } catch {
      // Preserve the raw cookie if it was not URI encoded correctly.
    }

    return /^fb\.\d+\.[A-Za-z0-9._-]+$/.test(value) && value.length <= 255
      ? value
      : undefined;
  }

  return undefined;
}

function clientUserAgent(request: Request) {
  const value = request.headers.get("user-agent")?.trim();
  return value ? value.slice(0, 500) : undefined;
}

async function deliverToMeta(
  request: Request,
  event: TrackedEvent,
  conversionEventId: string,
  conversionEventTime: number,
  sourceUrl: string
) {
  const accessToken = configuredValue(process.env.META_CAPI_ACCESS_TOKEN);
  if (!accessToken) {
    if (!warnedAboutMissingConfiguration) {
      warnedAboutMissingConfiguration = true;
      console.warn("[meta-capi] delivery disabled: META_CAPI_ACCESS_TOKEN is not configured");
    }
    return false;
  }

  const userData = {
    client_ip_address: clientIpAddress(request),
    client_user_agent: clientUserAgent(request),
    fbp: cookieValue(request, "_fbp"),
    fbc: cookieValue(request, "_fbc"),
  };
  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: eventNames[event],
        event_time: conversionEventTime,
        event_id: conversionEventId,
        action_source: "website",
        event_source_url: sourceUrl,
        user_data: Object.fromEntries(
          Object.entries(userData).filter(([, value]) => Boolean(value))
        ),
      },
    ],
  };
  const testEventCode = configuredValue(process.env.META_TEST_EVENT_CODE);
  if (testEventCode) payload.test_event_code = testEventCode;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), metaRequestTimeoutMs);

  try {
    const response = await fetch(
      `https://graph.facebook.com/${graphApiVersion()}/${datasetId()}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      console.warn(`[meta-capi] delivery failed with status ${response.status}`);
      return false;
    }

    return true;
  } catch {
    console.warn("[meta-capi] delivery failed");
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    return Response.json({ accepted: false }, { status: 413 });
  }
  if (!sameOriginRequest(request)) {
    return Response.json({ accepted: false }, { status: 403 });
  }

  let body: ConversionRequest;
  try {
    body = (await request.json()) as ConversionRequest;
  } catch {
    return Response.json({ accepted: false }, { status: 400 });
  }

  const event = typeof body.event === "string" && body.event in eventNames
    ? body.event as TrackedEvent
    : null;
  const conversionEventId = eventId(body.event_id);
  const sourceUrl = safeSourceUrl(body.event_source_url, request);

  if (!event || !conversionEventId || !sourceUrl) {
    return Response.json({ accepted: false }, { status: 400 });
  }

  const delivered = await deliverToMeta(
    request,
    event,
    conversionEventId,
    eventTime(body.event_time),
    sourceUrl
  );

  // Tracking failure is intentionally accepted so it cannot affect product actions.
  return Response.json({ accepted: true, delivered }, { status: 202 });
}
