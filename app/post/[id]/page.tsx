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

const fallbackImage = "/brand/bantrboks-approved-website-landing.png";

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
  if (!post?.body) return "View this take in the Springboks vs All Blacks Bantrboks room.";
  return post.body.length > 180 ? `${post.body.slice(0, 177)}…` : post.body;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getSharedPost(id);
  const title = `${postAuthor(post)} on Bantrboks`;
  const description = postDescription(post);
  const image = post?.media_url || fallbackImage;
  const canonical = `/post/${encodeURIComponent(id)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      siteName: "Bantrboks",
      title,
      description,
      images: [{ url: image, alt: `${title} post preview` }],
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

  return (
    <main className="shared-post-page">
      <header>
        <a href="/" aria-label="Open Bantrboks">
          <img src="/bantrboks-logo.png" alt="Bantrboks" />
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
          <p>{post.body}</p>
          {post.media_url ? <img className="shared-post-media" src={post.media_url} alt="Shared Bantrboks post" /> : null}
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
