import { ImageResponse } from "next/og";
import { supabase } from "../../../supabase";

export const runtime = "edge";

type PreviewPost = {
  body: string | null;
  profiles?: {
    handle?: string | null;
    display_name?: string | null;
  } | null;
};

function previewText(value: string | null | undefined) {
  const text = (value || "")
    .replace(/https?:\/\/[^\s<]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || "Drop just hit";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data } = await supabase
    .from("posts")
    .select("body, profiles(handle, display_name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  const post = data as unknown as PreviewPost | null;
  const author = post?.profiles?.handle || post?.profiles?.display_name || "Bantrboks";
  const text = previewText(post?.body).slice(0, 280);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px 80px",
          color: "white",
          background: "linear-gradient(135deg, #020403 0%, #0b2018 55%, #050707 100%)",
          border: "14px solid #ffd800",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 900, color: "#ffd800" }}>
            B&nbsp; BANTRBOKS
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#38d2d2" }}>DROP JUST HIT</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontSize: text.length > 170 ? 48 : 60, lineHeight: 1.12, fontWeight: 800 }}>
            {text}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#ffd800" }}>@{author.replace(/^@/, "")}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#c7d0cc" }}>
          <span>Springboks vs All Blacks</span>
          <span>bantrboks.com</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
    },
  );
}
