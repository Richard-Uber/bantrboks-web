const previewTimeoutMs = 6000;
const previewBodyLimit = 384 * 1024;
const supportedPreviewHosts = [
  "bantrbox.com",
  "bantrboks.com",
  "facebook.com",
  "fb.watch",
  "instagram.com",
  "linkedin.com",
  "reddit.com",
  "threads.net",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtu.be",
  "youtube.com",
];

function isPrivateHostname(hostname: string) {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "localhost" || value.endsWith(".localhost") || value.endsWith(".local") || value.endsWith(".internal")) return true;
  if (value === "::1" || value === "0:0:0:0:0:0:0:1") return true;

  const ipv4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const parts = ipv4.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] >= 224
  );
}

function isSupportedPreviewHostname(hostname: string) {
  const value = hostname.toLowerCase().replace(/^www\./, "");
  return supportedPreviewHosts.some((host) => value === host || value.endsWith(`.${host}`));
}

function safeWebUrl(value: string, base?: string, requireSupportedHost = true) {
  try {
    const url = new URL(value, base);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      isPrivateHostname(url.hostname) ||
      (requireSupportedHost && !isSupportedPreviewHostname(url.hostname))
    ) return null;
    url.username = "";
    url.password = "";
    return url;
  } catch {
    return null;
  }
}

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function tagAttributes(tag: string) {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function metadata(html: string) {
  const values = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = tagAttributes(tag);
    const key = (attributes.get("property") || attributes.get("name") || "").toLowerCase();
    const content = attributes.get("content");
    if (key && content && !values.has(key)) values.set(key, decodeHtml(content));
  }
  const title = decodeHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  return { values, title };
}

async function readLimitedHtml(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let html = "";

  while (total < previewBodyLimit) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    html += decoder.decode(value, { stream: true });
  }
  reader.cancel().catch(() => undefined);
  return html;
}

export async function GET(request: Request) {
  const requested = safeWebUrl(new URL(request.url).searchParams.get("url") || "");
  if (!requested) return Response.json({ error: "Invalid public web address." }, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), previewTimeoutMs);

  try {
    let current = requested;
    let response: Response | null = null;

    for (let redirects = 0; redirects <= 3; redirects += 1) {
      response = await fetch(current, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (compatible; BantrboksLinkPreview/1.0; +https://bantrboks.com)",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const redirected = safeWebUrl(response.headers.get("location") || "", current.href);
      if (!redirected) throw new Error("Unsafe redirect");
      current = redirected;
    }

    if (!response?.ok) throw new Error("Preview request failed");
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("Not an HTML page");
    }

    const html = await readLimitedHtml(response);
    const { values, title } = metadata(html);
    const rawImage = values.get("og:image") || values.get("twitter:image") || "";
    const image = rawImage ? safeWebUrl(rawImage, current.href, false)?.href || "" : "";
    const payload = {
      url: current.href,
      title: values.get("og:title") || values.get("twitter:title") || title || current.hostname,
      description: values.get("og:description") || values.get("twitter:description") || values.get("description") || "",
      image,
      siteName: values.get("og:site_name") || current.hostname.replace(/^www\./, ""),
    };

    return Response.json(payload, {
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return Response.json({ error: "Preview unavailable." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
