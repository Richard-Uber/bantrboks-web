"use client";

import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";

type View = "feed" | "create" | "ladder" | "profile";
type ReactionType = "slap" | "mic";

type ProfileData = {
  id: string;
  handle: string;
  displayName: string;
  email: string;
  avatar?: string;
};

type BantrReply = {
  id: string;
  body: string;
  handle: string;
  createdAt: string;
};

type BantrPost = {
  id: string;
  authorId: string;
  handle: string;
  displayName: string;
  avatar: string;
  body: string;
  tags: string[];
  mediaUrl?: string;
  audioUrl?: string;
  slaps: number;
  fdrops: number;
  replies: BantrReply[];
  createdAt: string;
};

const room = {
  name: "Springboks vs All Blacks",
  hash: "#springboksvsallblacks",
  left: "BOKS",
  right: "ABS",
};

const mediaBucket = "bantrbox-media";

export default function Home() {
  const [view, setView] = useState<View>("feed");
  const [posts, setPosts] = useState<BantrPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [mediaPreview, setMediaPreview] = useState<string | undefined>();
  const [mediaFile, setMediaFile] = useState<File | undefined>();
  const [mediaName, setMediaName] = useState<string | undefined>();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData>({
    id: "",
    handle: "@bantrbok",
    displayName: "Bantrbok",
    email: "",
  });
  const [authMode, setAuthMode] = useState<"sign-in" | "create">("create");
  const [password, setPassword] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [toast, setToast] = useState("Bantrboks room live");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPosts = useCallback(async () => {
    setIsLoadingPosts(true);

    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        id,
        author_id,
        body,
        visibility,
        tags,
        media_url,
        audio_url,
        created_at,
        profiles (
          handle,
          display_name,
          avatar
        ),
        post_reactions (
          reaction
        ),
        comments (
          id,
          body,
          created_at,
          deleted_at,
          profiles (
            handle
          )
        )
      `,
      )
      .contains("tags", [room.name])
      .is("deleted_at", null)
      .or("moderation_status.is.null,moderation_status.eq.visible")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) {
      setToast(error?.message ? `Feed could not load: ${error.message}` : "Feed could not load");
      setPosts([]);
      setIsLoadingPosts(false);
      return;
    }

    setPosts(data.map(postFromRow));
    setIsLoadingPosts(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user ?? null);
      if (data.user) {
        await loadProfile(data.user);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const ladder = useMemo(() => {
    const scores = new Map<string, { handle: string; displayName: string; score: number; avatar: string }>();
    posts.forEach((post) => {
      const current = scores.get(post.handle) ?? {
        handle: post.handle,
        displayName: post.displayName,
        avatar: post.avatar,
        score: 0,
      };
      current.score += post.slaps + post.fdrops * 2 + post.replies.length * 3;
      scores.set(post.handle, current);
    });
    return Array.from(scores.values()).sort((a, b) => b.score - a.score);
  }, [posts]);

  async function loadProfile(nextUser: User) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, handle, display_name, avatar")
      .eq("id", nextUser.id)
      .maybeSingle();

    const fallback = {
      id: nextUser.id,
      email: nextUser.email ?? "",
      handle: normalizeHandle(String(nextUser.user_metadata?.handle ?? nextUser.email?.split("@")[0] ?? "bantrbok")),
      display_name: String(nextUser.user_metadata?.display_name ?? "Bantrbok"),
      avatar: undefined,
    };

    const nextProfile = data ?? fallback;
    setProfile({
      id: nextProfile.id,
      email: nextProfile.email,
      handle: normalizeHandle(nextProfile.handle),
      displayName: nextProfile.display_name,
      avatar: nextProfile.avatar ?? undefined,
    });
  }

  async function ensureProfile(activeUser: User) {
    const cleanHandle = normalizeHandle(profile.handle);
    const cleanDisplayName = profile.displayName.trim() || cleanHandle.replace("@", "") || "Bantrbok";

    const { error } = await supabase.from("profiles").upsert({
      id: activeUser.id,
      email: activeUser.email ?? profile.email,
      handle: cleanHandle,
      display_name: cleanDisplayName,
      avatar: profile.avatar ?? null,
      bantr_feed: [room.name],
    });

    if (error) throw new Error(error.message);

    setProfile((current) => ({
      ...current,
      id: activeUser.id,
      email: activeUser.email ?? current.email,
      handle: cleanHandle,
      displayName: cleanDisplayName,
    }));
  }

  async function authenticate() {
    const email = profile.email.trim();
    const cleanPassword = password.trim();
    if (!email || !cleanPassword) {
      setToast("Add email and password first");
      return;
    }

    setIsAuthBusy(true);
    try {
      if (authMode === "create") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: cleanPassword,
          options: {
            data: {
              handle: normalizeHandle(profile.handle),
              display_name: profile.displayName.trim() || "Bantrbok",
            },
          },
        });
        if (error) throw new Error(error.message);
        if (data.user && data.session) {
          await ensureProfile(data.user);
          setToast("Welcome to Bantrboks");
        } else {
          setToast("Check your email to verify, then sign in");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: cleanPassword });
        if (error) throw new Error(error.message);
        if (data.user) await ensureProfile(data.user);
        setToast("Signed in");
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Auth failed");
    } finally {
      setIsAuthBusy(false);
    }
  }

  function handleMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setMediaName(file.name);
    setToast("Media ready for the bantr");
  }

  async function uploadMedia(activeUser: User) {
    if (!mediaFile) return undefined;

    const safeName = mediaFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `posts/${activeUser.id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(mediaBucket).upload(filePath, mediaFile, {
      cacheControl: "3600",
      contentType: mediaFile.type || "application/octet-stream",
      upsert: false,
    });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(mediaBucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function createPost() {
    if (isPosting) return;

    const clean = draft.trim();
    if (!clean && !mediaFile) {
      setToast("Add text or media first");
      return;
    }

    if (!user) {
      setToast("Create an account or sign in to post");
      setView("profile");
      return;
    }

    setIsPosting(true);
    setToast(mediaFile ? "Uploading media..." : "Posting bantr...");

    try {
      await ensureProfile(user);
      const mediaUrl = await uploadMedia(user);
      const postId = String(Date.now());
      const { error } = await supabase.from("posts").insert({
        id: postId,
        author_id: user.id,
        body: clean,
        visibility: "Everyone",
        tags: [room.name, "bantrbox", "bantrboks"],
        media_url: mediaUrl ?? null,
      });

      if (error) throw new Error(error.message);

      setDraft("");
      setMediaFile(undefined);
      setMediaPreview(undefined);
      setMediaName(undefined);
      await loadPosts();
      setToast("Bantr posted to Boks vs ABs");
      setView("feed");
    } catch (error) {
      setToast(error instanceof Error ? `Bantr did not post: ${error.message}` : "Bantr did not post");
    } finally {
      setIsPosting(false);
    }
  }

  async function react(postId: string, type: ReactionType) {
    if (!user) {
      setToast("Sign in to react");
      setView("profile");
      return;
    }

    try {
      await ensureProfile(user);
      const { error } = await supabase.from("post_reactions").upsert(
        {
          id: `${user.id}-${postId}-${type}`,
          user_id: user.id,
          post_id: postId,
          reaction: type,
        },
        { onConflict: "user_id,post_id,reaction" },
      );
      if (error) throw new Error(error.message);
      await loadPosts();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Reaction failed");
    }
  }

  async function reply(postId: string) {
    const clean = replyDrafts[postId]?.trim();
    if (!clean) return;

    if (!user) {
      setToast("Sign in to reply");
      setView("profile");
      return;
    }

    try {
      await ensureProfile(user);
      const { error } = await supabase.from("comments").insert({
        id: String(Date.now()),
        post_id: postId,
        author_id: user.id,
        body: clean,
      });
      if (error) throw new Error(error.message);

      setReplyDrafts((current) => ({ ...current, [postId]: "" }));
      await loadPosts();
      setToast("Reply added");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Reply failed");
    }
  }

  async function share(post: BantrPost) {
    const link = `https://bantrboks.com/posts/${post.id}`;
    const text = `Check this Boks vs ABs bantr from ${post.handle} on Bantrboks: ${link}`;

    if (navigator.share) {
      await navigator.share({ title: "Bantrboks", text, url: link }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(text).catch(() => undefined);
    }
    setToast("Share link ready");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile({ id: "", handle: "@bantrbok", displayName: "Bantrbok", email: "" });
    setPassword("");
    setToast("Signed out");
  }

  return (
    <main className="bantrboks-shell">
      <section className="phone-frame" aria-label="Bantrboks launch web app">
        <header className="app-header">
          <Brand />
          <button className="profile-dot" onClick={() => setView("profile")} aria-label="Open profile">
            <Avatar value={profile.avatar} fallback={initials(profile.displayName || profile.handle)} />
          </button>
        </header>

        <div className="app-body">
          <div className="view-header">
            <h1>{viewTitle(view)}</h1>
            <RoomBadge />
          </div>

          {toast && <p className="toast">{toast}</p>}

          {view === "feed" && (
            <Feed
              posts={posts}
              isLoadingPosts={isLoadingPosts}
              replyDrafts={replyDrafts}
              setReplyDrafts={setReplyDrafts}
              onReact={react}
              onReply={reply}
              onShare={share}
            />
          )}

          {view === "create" && (
            <Create
              draft={draft}
              setDraft={setDraft}
              mediaPreview={mediaPreview}
              mediaName={mediaName}
              fileInputRef={fileInputRef}
              handleMedia={handleMedia}
              createPost={createPost}
              isPosting={isPosting}
              clearPost={() => {
                setDraft("");
                setMediaFile(undefined);
                setMediaPreview(undefined);
                setMediaName(undefined);
                setToast("Draft cleared");
              }}
            />
          )}

          {view === "ladder" && <Ladder ladder={ladder} />}

          {view === "profile" && (
            <Profile
              profile={profile}
              setProfile={setProfile}
              postCount={posts.filter((post) => post.authorId === user?.id).length}
              authMode={authMode}
              setAuthMode={setAuthMode}
              password={password}
              setPassword={setPassword}
              user={user}
              authenticate={authenticate}
              isAuthBusy={isAuthBusy}
              signOut={signOut}
            />
          )}
        </div>

        <nav className="bottom-nav" aria-label="Bantrboks sections">
          <NavButton label="Bantr" active={view === "feed"} onClick={() => setView("feed")} icon="⌂" />
          <NavButton label="Ladder" active={view === "ladder"} onClick={() => setView("ladder")} icon="♛" />
          <NavButton label="Create" active={view === "create"} onClick={() => setView("create")} icon="+" />
          <NavButton label="Profile" active={view === "profile"} onClick={() => setView("profile")} icon="●" />
        </nav>
      </section>

      <aside className="desktop-story" aria-label="Bantrboks launch summary">
        <p className="eyebrow">Single-room rivalry web app</p>
        <h2>Bantrboks is the Boks vs ABs room, ready for launch.</h2>
        <p>
          A mobile-first web experience for public bantr, fast posting, reactions, replies,
          sharing and a room ladder. It keeps the Bantrbox energy, but locks the experience to
          Springboks vs All Blacks.
        </p>
        <div className="desktop-actions">
          <button onClick={() => setView("create")}>Create a bantr</button>
          <button onClick={() => setView("ladder")}>View ladder</button>
        </div>
      </aside>
    </main>
  );
}

function Brand() {
  return (
    <div className="brand-lockup" aria-label="Bantrboks">
      <img src="/bantrboks-logo.png" alt="Bantrboks" />
    </div>
  );
}

function RoomBadge() {
  return (
    <div className="room-badge" aria-label={room.name}>
      <span>{room.left}</span>
      <strong>VS</strong>
      <span>{room.right}</span>
    </div>
  );
}

function Feed({
  posts,
  isLoadingPosts,
  replyDrafts,
  setReplyDrafts,
  onReact,
  onReply,
  onShare,
}: {
  posts: BantrPost[];
  isLoadingPosts: boolean;
  replyDrafts: Record<string, string>;
  setReplyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onReact: (postId: string, type: ReactionType) => void;
  onReply: (postId: string) => void;
  onShare: (post: BantrPost) => void;
}) {
  return (
    <section className="feed-stack">
      <div className="room-strip">
        <MiniRoomCard title="Boks pressure" handle="@bantrboks" />
        <MiniRoomCard title="ABs receipts" handle="@bantrabs" accent="green" />
        <MiniRoomCard title="Scrum court" handle="@rugbybantr" accent="cyan" />
      </div>

      {isLoadingPosts && <div className="empty-card">Loading the Boks vs ABs room...</div>}

      {!isLoadingPosts && posts.length === 0 && (
        <div className="empty-card">
          <strong>No room bantr yet</strong>
          <span>Create the first Boks vs ABs post.</span>
        </div>
      )}

      {posts.map((post, index) => (
        <article className={`post-card theme-${index % 4}`} key={post.id}>
          <PostHeader post={post} />
          <p className="room-hash">{room.hash}</p>
          {post.body && <p className="post-body">{post.body}</p>}
          <p className="tag">#bantrboks</p>
          <MediaBlock post={post} />
          <p className="open-hint">Tap to open full bantr</p>
          <div className="reaction-grid">
            <button onClick={() => onReact(post.id, "slap")}>
              👋 <span>SLAP</span><strong>{post.slaps}</strong>
            </button>
            <button onClick={() => onReact(post.id, "mic")}>
              🔥 <span>F Drop</span><strong>{post.fdrops}</strong>
            </button>
            <button>
              💬 <span>Reply</span><strong>{post.replies.length}</strong>
            </button>
            <button className="share" onClick={() => onShare(post)}>↗ <span>Share</span></button>
          </div>
          <div className="reply-row">
            <input
              value={replyDrafts[post.id] ?? ""}
              onChange={(event) =>
                setReplyDrafts((current) => ({ ...current, [post.id]: event.target.value }))
              }
              placeholder="Say something..."
            />
            <button onClick={() => onReply(post.id)}>send</button>
          </div>
          {post.replies.length > 0 && (
            <div className="reply-list">
              {post.replies.slice(-6).map((reply) => (
                <p key={reply.id}>
                  <strong>{reply.handle}</strong> {reply.body}
                </p>
              ))}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function Create({
  draft,
  setDraft,
  mediaPreview,
  mediaName,
  fileInputRef,
  handleMedia,
  createPost,
  isPosting,
  clearPost,
}: {
  draft: string;
  setDraft: (value: string) => void;
  mediaPreview?: string;
  mediaName?: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleMedia: (event: ChangeEvent<HTMLInputElement>) => void;
  createPost: () => void;
  isPosting: boolean;
  clearPost: () => void;
}) {
  const isVideo = Boolean(mediaPreview && /\.(mp4|mov|webm|ogg)$/i.test(mediaName ?? ""));

  return (
    <section className="create-stack">
      {(draft || mediaPreview) && (
        <div className="preview-card">
          <h2>Preview</h2>
          {mediaPreview ? (
            isVideo ? (
              <video src={mediaPreview} controls playsInline />
            ) : (
              <img src={mediaPreview} alt={mediaName ?? "Selected media"} />
            )
          ) : (
            <div className="media-placeholder">BOKS VS ABS BANTRJAB</div>
          )}
          {draft && <p>{draft}</p>}
        </div>
      )}

      <label className="composer">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={100}
          rows={draft.length > 80 ? 4 : 1}
          placeholder="What do you want to bantr about?"
        />
        <span>{room.hash}</span>
        <strong>{draft.length}/100</strong>
      </label>

      <div className="tool-row">
        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleMedia} hidden />
        <button onClick={() => fileInputRef.current?.click()}>Gallery</button>
        <button onClick={() => fileInputRef.current?.click()}>Upload</button>
        <button>Voice later</button>
      </div>

      <div className="launch-note">
        <h2>Locked room</h2>
        <p>Every post goes into {room.name}. The app room and this web room share the same feed.</p>
      </div>

      <button className="primary-action" onClick={createPost} disabled={isPosting}>
        {isPosting ? "Posting..." : "Post"}
      </button>
      <button className="danger-action" onClick={clearPost} disabled={isPosting}>Discard post</button>
    </section>
  );
}

function Ladder({
  ladder,
}: {
  ladder: { handle: string; displayName: string; score: number; avatar: string }[];
}) {
  return (
    <section className="ladder-stack">
      <div className="ladder-toggle">
        <button className="active">Room ladder</button>
        <button>Combined in app</button>
      </div>
      {ladder.length === 0 && <div className="empty-card">The room ladder will appear once people post and react.</div>}
      {ladder.map((row, index) => (
        <article className={`ladder-row row-${index}`} key={row.handle}>
          <span className="rank">{index + 1}</span>
          <Avatar value={row.avatar} fallback={initials(row.displayName || row.handle)} />
          <div>
            <h2>{row.handle}</h2>
            <p>{row.displayName}</p>
          </div>
          <strong>ϟ {row.score}</strong>
        </article>
      ))}
    </section>
  );
}

function Profile({
  profile,
  setProfile,
  postCount,
  authMode,
  setAuthMode,
  password,
  setPassword,
  user,
  authenticate,
  isAuthBusy,
  signOut,
}: {
  profile: ProfileData;
  setProfile: Dispatch<SetStateAction<ProfileData>>;
  postCount: number;
  authMode: "sign-in" | "create";
  setAuthMode: (mode: "sign-in" | "create") => void;
  password: string;
  setPassword: (value: string) => void;
  user: User | null;
  authenticate: () => void;
  isAuthBusy: boolean;
  signOut: () => void;
}) {
  const isCreateMode = authMode === "create";

  return (
    <section className="profile-stack">
      <div className="auth-hero">
        <div className="auth-icon">B</div>
        <h2>BANTRBOKS</h2>
        <span />
        <strong>Drop takes. Win likes. Climb the board.</strong>
        <p>Bantrboks is a division of Bantrbox.com.</p>
      </div>

      <p className="auth-legal">
        By tapping "Create Account" or "Sign In", you agree to our Terms. Learn how we process your data in our
        Privacy Policy.
      </p>

      <div className="auth-tabs">
        <button className={isCreateMode ? "active" : ""} onClick={() => setAuthMode("create")}>
          Create
        </button>
        <button className={!isCreateMode ? "active" : ""} onClick={() => setAuthMode("sign-in")}>
          Sign in
        </button>
      </div>

      {isCreateMode && (
        <>
          <input
            value={profile.displayName}
            onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))}
            placeholder="Display name"
          />
          <input
            value={profile.handle}
            onChange={(event) => setProfile((current) => ({ ...current, handle: normalizeHandle(event.target.value) }))}
            placeholder="Handle"
          />
        </>
      )}
      <input
        value={profile.email}
        onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
        placeholder="Email"
        type="email"
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        type="password"
      />
      <button className="primary-action" onClick={authenticate} disabled={isAuthBusy}>
        {isAuthBusy ? "Working..." : isCreateMode ? "Create Account" : "Sign in"}
      </button>
      {!user && (
        <button
          className="secondary-action"
          onClick={() => setAuthMode(isCreateMode ? "sign-in" : "create")}
          disabled={isAuthBusy}
        >
          {isCreateMode ? "I already have an account" : "Create a new account"}
        </button>
      )}
      {user && (
        <div className="profile-card">
          <Avatar value={profile.avatar} fallback={initials(profile.displayName || profile.handle)} size="big" />
          <h2>{profile.handle}</h2>
          <p>Signed in to Bantrboks</p>
          <div className="profile-stats">
            <span>{postCount}<small>bantrs</small></span>
            <span>{room.left}<small>side</small></span>
            <span>{room.right}<small>rival</small></span>
          </div>
        </div>
      )}
      {user && (
        <button className="danger-action" onClick={signOut}>
          Sign out
        </button>
      )}
    </section>
  );
}

function MiniRoomCard({ title, handle, accent = "yellow" }: { title: string; handle: string; accent?: string }) {
  return (
    <div className={`mini-card ${accent}`}>
      <RoomBadge />
      <strong>{title}</strong>
      <span>{handle}</span>
      <em>{room.hash}</em>
    </div>
  );
}

function MediaBlock({ post }: { post: BantrPost }) {
  const media = post.mediaUrl ?? post.audioUrl;
  if (media) {
    const isVideo = /\.(mp4|mov|webm|ogg)(\?|$)/i.test(media);
    const isAudio = /\.(m4a|aac|mp3|mpeg|webm)(\?|$)/i.test(media) && !isVideo;
    return (
      <div className="media-frame">
        {isVideo ? (
          <video src={media} controls playsInline />
        ) : isAudio ? (
          <audio src={media} controls />
        ) : (
          <img src={media} alt="Bantr media" />
        )}
      </div>
    );
  }

  return (
    <div className="media-frame generated">
      <div>
        <span>{room.left}</span>
        <strong>VS</strong>
        <span>{room.right}</span>
      </div>
      <h2>BOKS V ABS BANTRJAB</h2>
      <p>Drop takes. Win likes. Climb the board.</p>
    </div>
  );
}

function PostHeader({ post }: { post: BantrPost }) {
  return (
    <div className="post-head">
      <Avatar value={post.avatar} fallback={initials(post.displayName || post.handle)} />
      <div>
        <h2>{post.handle}</h2>
        <p>{post.displayName} · {post.createdAt}</p>
      </div>
      <button className="dots" aria-label="Post options">⋮</button>
    </div>
  );
}

function NavButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      <span>{icon}</span>
      {label}
    </button>
  );
}

function Avatar({ value, fallback, size }: { value?: string; fallback: string; size?: "big" }) {
  const isImage = Boolean(value && /^https?:\/\//i.test(value));
  return (
    <span className={`avatar ${size === "big" ? "big" : ""}`}>
      {isImage ? <img src={value} alt="" /> : value || fallback}
    </span>
  );
}

function postFromRow(row: any): BantrPost {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const reactions = Array.isArray(row.post_reactions) ? row.post_reactions : [];
  const comments = Array.isArray(row.comments) ? row.comments : [];
  const handle = normalizeHandle(profile?.handle ?? "bantrbok");
  const displayName = profile?.display_name ?? handle.replace("@", "");

  return {
    id: String(row.id),
    authorId: String(row.author_id),
    handle,
    displayName,
    avatar: profile?.avatar || initials(displayName || handle),
    body: row.body ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    mediaUrl: row.media_url ?? undefined,
    audioUrl: row.audio_url ?? undefined,
    slaps: reactions.filter((reaction: { reaction?: string }) => reaction.reaction === "slap").length,
    fdrops: reactions.filter((reaction: { reaction?: string }) => reaction.reaction === "mic").length,
    replies: comments
      .filter((comment: any) => !comment.deleted_at)
      .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((comment: any) => ({
        id: String(comment.id),
        body: comment.body ?? "",
        handle: normalizeHandle((Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles)?.handle ?? "bantrfan"),
        createdAt: timeAgo(comment.created_at),
      })),
    createdAt: timeAgo(row.created_at),
  };
}

function initials(value: string) {
  return value.replace("@", "").split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase() || "BB";
}

function normalizeHandle(value: string) {
  const clean = value.trim().replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, "");
  return clean ? `@${clean}` : "@";
}

function timeAgo(value?: string) {
  const created = value ? new Date(value).getTime() : Date.now();
  const diff = Math.max(0, Date.now() - created);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}M`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}H`;
  return `${Math.floor(hours / 24)}D`;
}

function viewTitle(view: View) {
  if (view === "feed") return "Bantr";
  if (view === "create") return "Create";
  if (view === "ladder") return "Ladder";
  return "Profile";
}
