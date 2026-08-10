"use client";

import { Dispatch, FormEvent, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

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
  const chatChannel = useRef<RealtimeChannel | null>(null);
  const chatEnd = useRef<HTMLDivElement | null>(null);

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

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newPost.trim()) {
      setStatus("Write a bantr first.");
      return;
    }
    setBusy("post");
    setStatus("");

    const { error } = await supabase.from("posts").insert({
      id: String(Date.now()),
      author_id: session.user.id,
      body: newPost.trim(),
      tags: [roomSlug, "bantrbox"],
      visibility: "Everyone",
    });

    setBusy("");
    if (error) {
      setStatus(`Bantr did not post: ${error.message}`);
      return;
    }

    setNewPost("");
    setStatus("Bantr posted to the Boks vs ABs room.");
    setView("home");
    loadData();
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
      <button className={view === nextView ? "is-active" : undefined} onClick={() => setView(nextView)} type="button">
        <span aria-hidden="true">{icon}</span>
        {label}
      </button>
    );
  }

  return (
    <main className="bb-app">
      <header className="bb-app-top">
        <img className="bb-app-logo" src="/bantrboks-logo.png" alt="Bantrboks" />
        <button className="bb-profile-dot" type="button" onClick={() => setView("profile")}>
          {initials(profile)}
        </button>
      </header>

      <section className="bb-room-hero">
        <div className="bb-room-icon" aria-label={roomName}>
          <span>BOKS</span>
          <strong>VS</strong>
          <span>ABS</span>
        </div>
        <p>Single room: {roomName}</p>
      </section>

      <section className="bb-viewbar">
        <h1>{view === "home" ? "Bantr" : view === "ranking" ? "Ladder" : view === "create" ? "Create" : view === "notifications" ? "Notifs" : view === "chat" ? "Live Chat" : "Profile"}</h1>
        <span>{roomName}</span>
      </section>

      {status ? <p className="bb-status">{status}</p> : null}

      <section className="bb-content">
        {view === "home" ? (
          <Feed posts={posts} comments={comments} postStats={postStats} busy={busy} react={react} addComment={addComment} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} />
        ) : null}

        {view === "ranking" ? (
          <section className="bb-card">
            <h2>{roomName} Ladder</h2>
            <div className="bb-ladder-list">
              {leaderboard.length ? leaderboard.map((row, index) => (
                <button className="bb-ladder-row" key={row.id} type="button" onClick={() => setView("profile")}>
                  <strong>{index + 1}</strong>
                  <span className="bb-avatar">{initials(row.profile)}</span>
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
              placeholder="What do you want to bantr about?"
            />
            <div className="bb-create-meta">
              <span>{roomHash}</span>
              <span>{newPost.length}/280</span>
            </div>
            <button className="bb-primary" type="submit" disabled={busy === "post"}>
              {busy === "post" ? "Posting..." : "Post"}
            </button>
            <button className="bb-secondary danger" type="button" onClick={() => setNewPost("")}>Discard post</button>
          </form>
        ) : null}

        {view === "notifications" ? (
          <section className="bb-card">
            <h2>Room notifications</h2>
            {notifications.length ? notifications.map((item) => (
              <article className="bb-notification" key={item.id}>
                <strong>{item.kind || "Bantrboks"}</strong>
                <p>{item.body}</p>
                <small>{roomName} • {formatAge(item.created_at)}</small>
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
            <span className="bb-avatar large">{initials(profile)}</span>
            <h2>{cleanHandle(profile)}</h2>
            <p>{profile?.display_name || session.user.email}</p>
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
              <span className="bb-avatar">{initials(post.profiles)}</span>
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
              <button type="button">💬 Reply <b>{stats.comments}</b></button>
              <button type="button" onClick={() => navigator.share?.({ title: "Bantrboks", text: post.body, url: window.location.href })}>Share</button>
            </div>
            <div className="bb-comments">
              {postComments.map((comment) => (
                <p key={comment.id}><strong>{cleanHandle(comment.profiles)}</strong> {comment.body}</p>
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
