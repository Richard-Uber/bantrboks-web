const allowedHosts = ["twitter.com", "x.com"];

function publicSocialUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (!allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) return null;
    return url;
  } catch {
    return null;
  }
}

function htmlShell(content: string, script = "") {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body{margin:0;background:#000;color:#f8f6ec;font-family:Arial,sans-serif}body{display:flex;justify-content:center}.embed{width:100%;max-width:680px;overflow:hidden}.fallback{padding:32px 18px;text-align:center;color:#aaa}iframe{border:0;max-width:100%}</style></head><body><main class="embed">${content}</main>${script}</body></html>`;
}

export async function GET(request: Request) {
  const url = publicSocialUrl(new URL(request.url).searchParams.get("url") || "");
  if (!url) return new Response("Invalid social post URL", { status: 400 });

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!((hostname === "x.com" || hostname === "twitter.com") && /\/status\/\d+/.test(url.pathname))) {
    return new Response("Social post cannot be safely embedded", { status: 422 });
  }

  const canonical = url.href.replace("x.com/", "twitter.com/");
  const body = htmlShell(
    `<blockquote class="twitter-tweet" data-theme="dark" data-dnt="true"><a href="${canonical.replace(/"/g, "&quot;")}">View post on X</a></blockquote>`,
    `<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`
  );

  return new Response(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src https://platform.twitter.com; frame-src https://platform.twitter.com https://syndication.twitter.com; img-src https: data:; connect-src https://*.twitter.com https://*.x.com; font-src https: data:;",
    },
  });
}
