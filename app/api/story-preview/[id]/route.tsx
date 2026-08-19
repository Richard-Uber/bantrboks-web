import { ImageResponse } from "next/og";
import { supabase } from "../../../supabase";

export const runtime = "edge";

type StoryPost = {
  body: string | null;
  media_url: string | null;
  profiles?: {
    handle?: string | null;
    display_name?: string | null;
  } | null;
};

const previewTimeoutMs = 4500;

function visibleText(value: string | null | undefined) {
  return (value || "")
    .replace(/https?:\/\/[^\s<]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstUrl(value: string | null | undefined) {
  return value?.match(/https?:\/\/[^\s<]+/i)?.[0]?.replace(/[),.!?;:'\"]+$/, "") ?? "";
}

async function linkedPreviewImage(origin: string, body: string | null) {
  const linkedUrl = firstUrl(body);
  if (!linkedUrl) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), previewTimeoutMs);
  try {
    const endpoint = new URL("/api/link-preview", origin);
    endpoint.searchParams.set("url", linkedUrl);
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) return "";
    const preview = await response.json() as { image?: string };
    return preview.image || "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function usablePostImage(url: string | null) {
  if (!url) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), previewTimeoutMs);
  try {
    const response = await fetch(url, { method: "HEAD", signal: controller.signal });
    return response.ok && response.headers.get("content-type")?.startsWith("image/") ? url : "";
  } catch {
    return /\.(avif|gif|jpe?g|png|webp)(?:\?|$)/i.test(url) ? url : "";
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const origin = new URL(request.url).origin;
  const { data } = await supabase
    .from("posts")
    .select("body, media_url, profiles(handle, display_name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  const post = data as unknown as StoryPost | null;
  const author = post?.profiles?.handle || post?.profiles?.display_name || "Bantrboks";
  const text = visibleText(post?.body).slice(0, 300);
  const image = await usablePostImage(post?.media_url ?? null) || await linkedPreviewImage(origin, post?.body ?? null);
  const fallbackImage = new URL("/brand/bantrboks-room-rivalry-v3.webp", origin).href;
  const logo = new URL("/bantrboks-logo.webp", origin).href;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "72px 68px 64px",
          color: "white",
          background: "linear-gradient(160deg, #020403 0%, #071a13 55%, #020303 100%)",
          border: "14px solid #ffd800",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <img src={logo} width="500" height="125" style={{ objectFit: "contain", objectPosition: "left center" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <span style={{ fontSize: 30, color: "#38d2d2", fontWeight: 800 }}>DROP JUST HIT</span>
            <span style={{ fontSize: 24, color: "#ffd800" }}>BANTRBOKS.COM</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            height: 890,
            marginTop: 70,
            border: "7px solid #38d2d2",
            borderRadius: 42,
            overflow: "hidden",
            background: "#050706",
          }}
        >
          <img
            src={image || fallbackImage}
            width="930"
            height="890"
            style={{ width: "100%", height: "100%", objectFit: image ? "cover" : "contain" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 32 }}>
          {text ? (
            <div
              style={{
                display: "flex",
                fontSize: text.length > 190 ? 48 : text.length > 100 ? 56 : 66,
                lineHeight: 1.12,
                fontWeight: 800,
              }}
            >
              {text}
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 66, lineHeight: 1.08, fontWeight: 900 }}>
              The rivalry just got louder.
            </div>
          )}
          <div style={{ display: "flex", fontSize: 34, color: "#ffd800", fontWeight: 800 }}>
            @{author.replace(/^@/, "")}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 34,
            borderTop: "3px solid #ffd800",
            fontSize: 28,
          }}
        >
          <span>Springboks vs All Blacks</span>
          <span style={{ color: "#38d2d2", fontWeight: 800 }}>Drop takes. Win likes.</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Content-Disposition": `inline; filename="bantrboks-story-${encodeURIComponent(id)}.png"`,
      },
    },
  );
}
