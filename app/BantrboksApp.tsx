"use client";

import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { BantrboksTagline } from "./BantrboksTagline";

type View = "home" | "ranking" | "create" | "notifications" | "chat" | "profile";
type Profile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar: string | null;
  bio: string | null;
};
type Post = {
  id: string;
  author_id: string;
  body: string;
  tags: string[];
  media_url: string | null;
  audio_url: string | null;
  created_at: string;
  profiles?: Profile | null;
};
type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles?: Profile | null;
};
type Reaction = {
  id: string;
  post_id: string;
  user_id: string;
  reaction: "slap" | "mic";
};
type NotificationRow = {
  id: string;
  body: string;
  kind: string | null;
  read_at: string | null;
  created_at: string;
};
type ChatMessage = {
  id: string;
  userId: string;
  handle: string;
  body: string;
  createdAt: string;
};

const roomName = "Springboks vs All Blacks";
const roomSlug = "springboksvsallblacks";
const roomHash = "#springboksvsallblacks";
const roomChannelName = "bantrboks-live-springboksvsallblacks";

function initials(profile?: Profile | null) {
  const source = profile?.handle || profile?.display_name || "BB";
  return source.slice(0, 2).toUpperCase();
}

function isImageAvatar(value?: string | null) {
  return Boolean(value && (/^https?:\/\//.test(value) || value.startsWith("/") || value.startsWith("data:")));
}

function Avatar({ profile, className = "" }: { profile?: Profile | null; className?: string }) {
  return (
    <span className={`bb-avatar ${className}`.trim()}>
      {isImageAvatar(profile?.avatar) ? <img src={profile?.avatar ?? ""} alt="" /> : initials(profile)}
    </span>
  );
}

function formatAge(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}M`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H`;
  return `${Math.floor(hours / 24)}D`;
}

function cleanHandle(profile?: Profile | null) {
  return profile?.handle ? `@${profile.handle}` : "@bantrboks";
}

function sharedFileName(source: string, mimeType: string) {
  const fallbackExtension: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };

  try {
    const candidate = decodeURIComponent(new URL(source).pathname.split("/").pop() || "");
    if (candidate.includes(".")) return candidate;
  } catch {
    // Use a stable filename when the stored media URL cannot be parsed.
  }

  return `bantrboks-post.${fallbackExtension[mimeType] || "bin"}`;
}

async function sharePost(post: Post) {
  if (!navigator.share) return;

  const mediaSource = post.media_url || post.audio_url;
  const postText = post.body.trim();
  const text = [postText, roomHash].filter(Boolean).join("\n\n");
  let file: File | null = null;

  if (mediaSource) {
    try {
      const response = await fetch(mediaSource);
      if (!response.ok) throw new Error("Media download failed.");
      const blob = await response.blob();
      const mimeType = blob.type || response.headers.get("content-type") || "application/octet-stream";
      file = new File([blob], sharedFileName(mediaSource, mimeType), { type: mimeType });
    } catch {
      // The direct media address below is the fallback if attachment sharing is unavailable.
    }
  }

  const attachedShare: ShareData = {
    title: "Bantrboks",
    text,
    ...(file ? { files: [file] } : {}),
  };
  const canAttach = file && (!navigator.canShare || navigator.canShare(attachedShare));
  const fallbackText = [text, mediaSource].filter(Boolean).join("\n\n");

  try {
    await navigator.share(canAttach ? attachedShare : { title: "Bantrboks", text: fallbackText });
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
  }
}

export function BantrboksApp({ session }: { session: Session }) {
  const [view, setView] = useState<View>("home");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [newPost, setNewPost] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [createMediaFile, setCreateMediaFile] = useState<File | null>(null);
  const [createMediaPreview, setCreateMediaPreview] = useState("");
  const chatChannel = useRef<RealtimeChannel | null>(null);
  const chatEnd = useRef<HTMLDivElement | null>(null);
  const galleryInput = useRef<HTMLInputElement | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const viewbar = useRef<HTMLElement | null>(null);

  const loadData = useCallback(async () => {
    const [profileRes, postsRes, commentsRes, reactionsRes, notificationsRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, handle, display_name, avatar, bio")
          .eq("id", session.user.id)
          .maybeSingle(),
        supabase
          .from("posts")
          .select("id, author_id, body, tags, media_url, audio_url, created_at, profiles(id, handle, display_name, avatar, bio)")
          .contains("tags", [roomSlug])
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("comments")
          .select("id, post_id, author_id, body, created_at, profiles(id, handle, display_name, avatar, bio)")
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(250),
        supabase
          .from("post_reactions")
          .select("id, post_id, user_id, reaction")
          .limit(500),
        supabase
          .from("notifications")
          .select("id, body, kind, read_at, created_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (postsRes.data) setPosts(postsRes.data as unknown as Post[]);
    if (commentsRes.data) setComments(commentsRes.data as unknown as Comment[]);
    if (reactionsRes.data) setReactions(reactionsRes.data as Reaction[]);
    if (notificationsRes.data) setNotifications(notificationsRes.data as NotificationRow[]);
  }, [session.user.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel(roomChannelName);
    chatChannel.current = channel;

    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        setChatMessages((current) => [...current, payload as ChatMessage].slice(-80));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      chatChannel.current = null;
    };
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages.length, view]);

  const postStats = useMemo(() => {
    const stats: Record<string, { slap: number; mic: number; comments: number }> = {};
    for (const post of posts) stats[post.id] = { slap: 0, mic: 0, comments: 0 };
    for (const reaction of reactions) {
      if (!stats[reaction.post_id]) continue;
      stats[reaction.post_id][reaction.reaction] += 1;
    }
    for (const comment of comments) {
      if (!stats[comment.post_id]) continue;
      stats[comment.post_id].comments += 1;
    }
    return stats;
  }, [comments, posts, reactions]);

  const leaderboard = useMemo(() => {
    const rows: Record<string, { profile: Profile | null | undefined; score: number }> = {};
    for (const post of posts) {
      rows[post.author_id] ??= { profile: post.profiles, score: 0 };
      rows[post.author_id].score +=
        1 + (postStats[post.id]?.slap ?? 0) + (postStats[post.id]?.mic ?? 0) + (postStats[post.id]?.comments ?? 0);
    }
    return Object.entries(rows)
      .map(([id, row]) => ({ id, ...row }))
      .sort((a, b) => b.score - a.score);
  }, [postStats, posts]);

  function chooseCreateMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (createMediaPreview) URL.revokeObjectURL(createMediaPreview);
    setCreateMediaFile(file);
    setCreateMediaPreview(URL.createObjectURL(file));
    event.target.value = "";
  }

  function clearCreateDraft() {
    if (createMediaPreview) URL.revokeObjectURL(createMediaPreview);
    setCreateMediaPreview("");
    setCreateMediaFile(null);
    setNewPost("");
  }

  async function uploadMediaFile(file: File, folder: string) {
    const safeExt = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${folder}/${session.user.id}/${Date.now()}.${safeExt}`;
    const { error } = await supabase.storage.from("bantrbox-media").upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("bantrbox-media").getPublicUrl(path);
    return data.publicUrl;
  }

  async function updateAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    setBusy("avatar");
    setStatus("");
    try {
      const publicUrl = await uploadMediaFile(file, "bantrboks-avatars");
      const { error } = await supabase.from("profiles").update({ avatar: publicUrl }).eq("id", session.user.id);
      if (error) throw error;
      setProfile((current) => (current ? { ...current, avatar: publicUrl } : current));
      setStatus("Profile picture updated.");
      loadData();
    } catch (error) {
      setStatus(`Profile picture did not update: ${error instanceof Error ? error.message : "Upload failed."}`);
    } finally {
      setBusy("");
      event.target.value = "";
    }
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = newPost.trim();
    if (!body && !createMediaFile) {
      setStatus("Add text or media before posting.");
      return;
    }
    setBusy("post");
    setStatus("");

    try {
      const mediaUrl = createMediaFile ? await uploadMediaFile(createMediaFile, "bantrboks-posts") : null;
      const { error } = await supabase.from("posts").insert({
        id: String(Date.now()),
        author_id: session.user.id,
        body,
        tags: [roomSlug, "bantrbox"],
        media_url: mediaUrl,
        visibility: "Everyone",
      });
      if (error) throw error;

      clearCreateDraft();
      setStatus("Bantr posted to the Boks vs ABs room.");
      setView("home");
      loadData();
    } catch (error) {
      setStatus(`Bantr did not post: ${error instanceof Error ? error.message : "Upload failed."}`);
    } finally {
      setBusy("");
    }
  }

  async function react(postId: string, reaction: "slap" | "mic") {
    setBusy(`${postId}-${reaction}`);
    const existing = reactions.find(
      (item) => item.post_id === postId && item.user_id === session.user.id && item.reaction === reaction
    );

    const result = existing
      ? await supabase.from("post_reactions").delete().eq("id", existing.id)
      : await supabase.from("post_reactions").insert({
          id: `${postId}-${reaction}-${session.user.id}`,
          post_id: postId,
          user_id: session.user.id,
          reaction,
        });

    setBusy("");
    if (result.error) {
      setStatus(result.error.message);
      return;
    }
    loadData();
  }

  async function addComment(postId: string) {
    const body = commentDrafts[postId]?.trim();
    if (!body) return;

    setBusy(`comment-${postId}`);
    const { error } = await supabase.from("comments").insert({
      id: `${Date.now()}-${postId}`,
      post_id: postId,
      author_id: session.user.id,
      body,
    });
    setBusy("");

    if (error) {
      setStatus(error.message);
      return;
    }

    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
    loadData();
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chatDraft.trim() || !chatChannel.current) return;

    const message: ChatMessage = {
      id: `${Date.now()}-${session.user.id}`,
      userId: session.user.id,
      handle: cleanHandle(profile),
      body: chatDraft.trim(),
      createdAt: new Date().toISOString(),
    };

    setChatDraft("");
    setChatMessages((current) => [...current, message].slice(-80));
    await chatChannel.current.send({
      type: "broadcast",
      event: "message",
      payload: message,
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  function navButton(nextView: View, label: string, icon: string) {
    return (
      <button
        className={view === nextView ? "is-active" : undefined}
        onClick={() => {
          setView(nextView);
          requestAnimationFrame(() => viewbar.current?.scrollIntoView({ block: "start" }));
        }}
        type="button"
      >
        <span aria-hidden="true">{icon}</span>
        {label}
      </button>
    );
  }

  return (
    <main className={`bb-app${isComposerFocused ? " is-composing" : ""}`}>
      <header className="bb-app-top">
        <img className="bb-app-logo" src="/bantrboks-logo.png" alt="Bantrboks" />
        <button className="bb-profile-dot" type="button" onClick={() => setView("profile")}>
          <Avatar profile={profile} />
        </button>
      </header>

      <BantrboksTagline />

      <section className="bb-room-hero">
        <img src="/brand/bantrboks-room-boks-abs.png" alt="BOKS vs ABS Bantrboks room" />
      </section>

      <section className="bb-viewbar" ref={viewbar}>
        <h1>{view === "home" ? "Bantr" : view === "ranking" ? "Ladder" : view === "create" ? "Create" : view === "notifications" ? "Notifs" : view === "chat" ? "Live Chat" : "Profile"}</h1>
      </section>

      {status ? <p className="bb-status">{status}</p> : null}

      <section className="bb-content">
        {view === "home" ? (
          <Feed posts={posts} comments={comments} postStats={postStats} busy={busy} react={react} addComment={addComment} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} />
        ) : null}

        {view === "ranking" ? (
          <section className="bb-card">
            <h2>Room ladder</h2>
            <div className="bb-ladder-list">
              {leaderboard.length ? leaderboard.map((row, index) => (
                <button className="bb-ladder-row" key={row.id} type="button" onClick={() => setView("profile")}>
                  <strong>{index + 1}</strong>
                  <Avatar profile={row.profile} />
                  <span>
                    <b>{cleanHandle(row.profile)}</b>
                    <small>{row.profile?.display_name || "Bantrboks user"}</small>
                  </span>
                  <em>{row.score}</em>
                </button>
              )) : <p className="bb-muted">No room rankings yet. Create the first bantr.</p>}
            </div>
          </section>
        ) : null}

        {view === "create" ? (
          <form className="bb-create" onSubmit={createPost}>
            <label htmlFor="bantr-text">Drop a Boks vs ABs bantr</label>
            <textarea
              id="bantr-text"
              value={newPost}
              maxLength={280}
              onChange={(event) => setNewPost(event.target.value)}
              onFocus={() => setIsComposerFocused(true)}
              onBlur={() => setIsComposerFocused(false)}
              placeholder="What do you want to bantr about?"
            />
            <div className="bb-create-meta">
              <span>{roomHash}</span>
              <span>{newPost.length}/280</span>
            </div>
            <input className="bb-hidden-input" ref={galleryInput} type="file" accept="image/*,video/*" onChange={chooseCreateMedia} />
            <input className="bb-hidden-input" ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={chooseCreateMedia} />
            <div className="bb-create-tools">
              <button type="button" onClick={() => galleryInput.current?.click()}>Gallery</button>
              <button type="button" onClick={() => cameraInput.current?.click()}>Camera</button>
            </div>
            {createMediaPreview ? (
              <div className="bb-create-preview">
                {createMediaFile?.type.startsWith("video/") ? (
                  <video src={createMediaPreview} controls />
                ) : (
                  <img src={createMediaPreview} alt="Selected bantr media" />
                )}
                <button type="button" onClick={() => {
                  if (createMediaPreview) URL.revokeObjectURL(createMediaPreview);
                  setCreateMediaPreview("");
                  setCreateMediaFile(null);
                }}>
                  Remove media
                </button>
              </div>
            ) : null}
            <button className="bb-primary" type="submit" disabled={busy === "post"}>
              {busy === "post" ? "Posting..." : "Post"}
            </button>
            <button className="bb-secondary danger" type="button" onClick={clearCreateDraft}>Discard post</button>
          </form>
        ) : null}

        {view === "notifications" ? (
          <section className="bb-card">
            <h2>Room notifications</h2>
            {notifications.length ? notifications.map((item) => (
              <article className="bb-notification" key={item.id}>
                <strong>{item.kind || "Bantrboks"}</strong>
                <p>{item.body}</p>
                <small>{formatAge(item.created_at)}</small>
              </article>
            )) : <p className="bb-muted">No notifications yet. Replies, slaps and F Drops from this room will show here.</p>}
          </section>
        ) : null}

        {view === "chat" ? (
          <section className="bb-card bb-chat">
            <h2>Live room chat</h2>
            <p className="bb-muted">Live chat is available for this Bantrboks room. Messages are live only and are not stored.</p>
            <div className="bb-chat-window">
              {chatMessages.length ? chatMessages.map((message) => (
                <div className={message.userId === session.user.id ? "is-mine" : undefined} key={message.id}>
                  <strong>{message.handle}</strong>
                  <p>{message.body}</p>
                </div>
              )) : <p className="bb-muted">No live messages yet. Start the room chat.</p>}
              <div ref={chatEnd} />
            </div>
            <form className="bb-chat-form" onSubmit={sendChat}>
              <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Live message..." />
              <button type="submit">Send</button>
            </form>
          </section>
        ) : null}

        {view === "profile" ? (
          <section className="bb-card bb-profile">
            <input className="bb-hidden-input" ref={avatarInput} type="file" accept="image/*" onChange={updateAvatar} />
            <button className="bb-avatar-button" type="button" onClick={() => avatarInput.current?.click()} disabled={busy === "avatar"}>
              <Avatar profile={profile} className="large" />
            </button>
            <h2>{cleanHandle(profile)}</h2>
            <p>{profile?.display_name || session.user.email}</p>
            <button className="bb-secondary" type="button" onClick={() => avatarInput.current?.click()} disabled={busy === "avatar"}>
              {busy === "avatar" ? "Updating..." : "Change profile picture"}
            </button>
            {profile?.bio ? <p className="bb-bio">{profile.bio}</p> : <p className="bb-muted">No bio added yet.</p>}
            <button className="bb-secondary" type="button" onClick={signOut}>Sign out</button>
          </section>
        ) : null}
      </section>

      <nav className="bb-bottom-nav" aria-label="Bantrboks navigation">
        {navButton("home", "Home", "⌂")}
        {navButton("ranking", "Ranking", "🏆")}
        {navButton("create", "Create", "+")}
        {navButton("notifications", "Notifs", "●")}
        {navButton("chat", "Chat", "✉")}
      </nav>
    </main>
  );
}

function Feed({
  posts,
  comments,
  postStats,
  busy,
  react,
  addComment,
  commentDrafts,
  setCommentDrafts,
}: {
  posts: Post[];
  comments: Comment[];
  postStats: Record<string, { slap: number; mic: number; comments: number }>;
  busy: string;
  react: (postId: string, reaction: "slap" | "mic") => void;
  addComment: (postId: string) => void;
  commentDrafts: Record<string, string>;
  setCommentDrafts: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  const [sharingPostId, setSharingPostId] = useState("");
  const commentInputs = useRef<Record<string, HTMLInputElement | null>>({});

  function focusComment(postId: string, replyTo?: Profile | null) {
    if (replyTo) {
      const mention = `${cleanHandle(replyTo)} `;
      setCommentDrafts((current) => ({
        ...current,
        [postId]: current[postId]?.trim() ? current[postId] : mention,
      }));
    }

    requestAnimationFrame(() => {
      const input = commentInputs.current[postId];
      input?.focus();
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  if (!posts.length) {
    return (
      <section className="bb-card">
        <h2>No Boks vs ABs bantr yet</h2>
        <p className="bb-muted">Create the first post in the Springboks vs All Blacks room.</p>
      </section>
    );
  }

  return (
    <section className="bb-feed">
      {posts.map((post) => {
        const stats = postStats[post.id] || { slap: 0, mic: 0, comments: 0 };
        const postComments = comments.filter((comment) => comment.post_id === post.id).slice(-4);
        return (
          <article className="bb-post" key={post.id}>
            <header>
              <Avatar profile={post.profiles} />
              <div>
                <strong>{cleanHandle(post.profiles)}</strong>
                <small>{post.profiles?.display_name || "Bantrboks user"} • {formatAge(post.created_at)}</small>
              </div>
            </header>
            <span className="bb-tag">{roomHash}</span>
            <p className="bb-post-body">{post.body}</p>
            {post.media_url ? <img className="bb-post-media" src={post.media_url} alt="Bantr media" /> : null}
            {post.audio_url ? <audio className="bb-post-audio" src={post.audio_url} controls /> : null}
            <div className="bb-actions">
              <button type="button" onClick={() => react(post.id, "slap")} disabled={busy === `${post.id}-slap`}>👋 Slap <b>{stats.slap}</b></button>
              <button type="button" onClick={() => react(post.id, "mic")} disabled={busy === `${post.id}-mic`}>🔥 F Drop <b>{stats.mic}</b></button>
              <button type="button" onClick={() => focusComment(post.id)}>💬 Reply <b>{stats.comments}</b></button>
              <button
                type="button"
                disabled={sharingPostId === post.id}
                onClick={async () => {
                  setSharingPostId(post.id);
                  try {
                    await sharePost(post);
                  } finally {
                    setSharingPostId("");
                  }
                }}
              >
                {sharingPostId === post.id ? "Preparing…" : "Share"}
              </button>
            </div>
            <div className="bb-comments">
              {postComments.map((comment) => (
                <article className="bb-comment" key={comment.id}>
                  <p><strong>{cleanHandle(comment.profiles)}</strong> {comment.body}</p>
                  <button
                    type="button"
                    onClick={() => focusComment(post.id, comment.profiles)}
                    aria-label={`Reply to ${cleanHandle(comment.profiles)}`}
                  >
                    Reply
                  </button>
                </article>
              ))}
            </div>
            <form
              className="bb-comment-form"
              onSubmit={(event) => {
                event.preventDefault();
                addComment(post.id);
              }}
            >
              <input
                ref={(element) => {
                  commentInputs.current[post.id] = element;
                }}
                value={commentDrafts[post.id] || ""}
                onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                placeholder="Say something..."
              />
              <button type="submit" disabled={busy === `comment-${post.id}`}>{busy === `comment-${post.id}` ? "..." : "Send"}</button>
            </form>
          </article>
        );
      })}
    </section>
  );
}
