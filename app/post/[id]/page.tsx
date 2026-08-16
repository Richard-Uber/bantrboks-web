import type { Metadata } from "next";
import { supabase } from "../../supabase";

type SharedPost = {
  id: string;
  body: string;
  media_url: string | null;
  audio_url: string | null;
  created_at: string;
  profiles?: {
    handle: string | null;
    display_name: string | null;
    avatar: string | null;
  } | null;
};

const previewTimeoutMs = 4500;

function isImageUrl(value: string | null | undefined) {
  if (!value) return false;
  return /\.(avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(value);
}

async function getSharedPost(id: string) {
  const { data } = await supabase
    .from("posts")
    .select("id, body, media_url, audio_url, created_at, profiles(handle, display_name, avatar)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  return data as unknown as SharedPost | null;
}

function postAuthor(post: SharedPost | null) {
  return post?.profiles?.handle ? `@${post.profiles.handle}` : "@bantrboks";
}

function postDescription(post: SharedPost | null) {
  const text = post?.body?.replace(/https?:\/\/[^\s<]+/gi, "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function firstPostUrl(body: string) {
  return body.match(/https?:\/\/[^\s<]+/i)?.[0]?.replace(/[),.!?;:'\"]+$/, "") ?? "";
}

async function linkedPreviewImage(post: SharedPost | null) {
  const linkedUrl = firstPostUrl(post?.body ?? "");
  if (!linkedUrl) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), previewTimeoutMs);
  try {
    const endpoint = new URL("/api/link-preview", "https://bantrboks.com");
    endpoint.searchParams.set("url", linkedUrl);
    const response = await fetch(endpoint, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    if (!response.ok) return "";
    const preview = await response.json() as { image?: string };
    return preview.image || "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getSharedPost(id);
  const title = "Drop just hit";
  const description = postDescription(post);
  const image =
    (isImageUrl(post?.media_url) ? post?.media_url : "") ||
    await linkedPreviewImage(post) ||
    `/api/post-preview/${encodeURIComponent(id)}`;
  const canonical = `/post/${encodeURIComponent(id)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      siteName: "Bantrboks",
      locale: "en_ZA",
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: `${title} post preview` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function SharedPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getSharedPost(id);
  const linkedUrl = firstPostUrl(post?.body ?? "");
  const visibleBody = postDescription(post);
  const linkedImage = !post?.media_url && linkedUrl ? await linkedPreviewImage(post) : "";

  return (
    <main className="shared-post-page">
      <header>
        <a href="/" aria-label="Open Bantrboks">
          <img src="/bantrboks-logo.webp" alt="Bantrboks" />
        </a>
        <span>Drop takes. <strong>Win likes.</strong> Climb the board.</span>
      </header>

      {post ? (
        <article className="shared-post-card">
          <div className="shared-post-author">
            <span>{(post.profiles?.handle || post.profiles?.display_name || "BB").slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{postAuthor(post)}</strong>
              <small>{post.profiles?.display_name || "Bantrboks user"}</small>
            </div>
          </div>
          <b className="shared-post-tag">#springboksvsallblacks</b>
          {visibleBody ? <p>{visibleBody}</p> : null}
          {post.media_url ? (
            linkedUrl ? (
              <a className="shared-post-source" href={linkedUrl} target="_blank" rel="noopener noreferrer" aria-label="Open the original content">
                <img className="shared-post-media" src={post.media_url} alt="Shared Bantrboks post" />
              </a>
            ) : <img className="shared-post-media" src={post.media_url} alt="Shared Bantrboks post" />
          ) : null}
          {linkedUrl && linkedImage ? (
            <a className="shared-post-source" href={linkedUrl} target="_blank" rel="noopener noreferrer" aria-label="Open the original content">
              <img className="shared-post-media" src={linkedImage} alt="Original content preview" />
            </a>
          ) : null}
          {post.audio_url ? <audio src={post.audio_url} controls /> : null}
        </article>
      ) : (
        <section className="shared-post-card shared-post-missing">
          <h1>This bantr is no longer available.</h1>
          <p>Open Bantrboks to see the latest takes from the room.</p>
        </section>
      )}

      <section className="shared-post-cta">
        <h1>Join the bantr.</h1>
        <p>Drop takes. Win likes. Climb the board.</p>
        <a href="/">Open Bantrboks</a>
      </section>
    </main>
  );
}
