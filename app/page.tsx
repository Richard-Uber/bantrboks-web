"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";

type View = "feed" | "create" | "ladder" | "profile";

type BantrPost = {
  id: number;
  handle: string;
  displayName: string;
  avatar: string;
  body: string;
  mediaUrl?: string;
  mediaName?: string;
  slaps: number;
  fdrops: number;
  replies: string[];
  createdAt: string;
};

const room = {
  name: "Springboks vs All Blacks",
  hash: "#springboksvsallblacks",
  left: "BOKS",
  right: "ABS",
};

const seedPosts: BantrPost[] = [
  {
    id: 1,
    handle: "@bokrage",
    displayName: "Bok Rage",
    avatar: "BR",
    body: "Green and gold pressure is different. ABs fans can keep the history books, this one is about Saturday.",
    slaps: 24,
    fdrops: 12,
    replies: ["ABs by 8, relax.", "You said this last time too."],
    createdAt: "12M",
  },
  {
    id: 2,
    handle: "@hakaheat",
    displayName: "Haka Heat",
    avatar: "HH",
    body: "Boks talking like the breakdown belongs to them. See you after the first turnover.",
    slaps: 18,
    fdrops: 16,
    replies: ["Receipts saved.", "That first scrum will decide it."],
    createdAt: "27M",
  },
  {
    id: 3,
    handle: "@scrumcourt",
    displayName: "Scrum Court",
    avatar: "SC",
    body: "The room is simple: pick your side, drop your best bantr, climb the Boks vs ABs ladder.",
    slaps: 41,
    fdrops: 21,
    replies: ["This is going to be chaos."],
    createdAt: "1H",
  },
];

export default function Home() {
  const [view, setView] = useState<View>("feed");
  const [posts, setPosts] = useState(seedPosts);
  const [draft, setDraft] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [mediaPreview, setMediaPreview] = useState<string | undefined>();
  const [mediaName, setMediaName] = useState<string | undefined>();
  const [profile, setProfile] = useState({
    handle: "@bantrbok",
    displayName: "Bantrbok",
    email: "",
  });
  const [toast, setToast] = useState("Bantrboks room live");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handleMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMediaPreview(URL.createObjectURL(file));
    setMediaName(file.name);
    setToast("Media ready for the bantr");
  }

  function createPost() {
    const clean = draft.trim();
    if (!clean && !mediaPreview) {
      setToast("Add text or media first");
      return;
    }

    setPosts((current) => [
      {
        id: Date.now(),
        handle: profile.handle || "@bantrbok",
        displayName: profile.displayName || "Bantrbok",
        avatar: initials(profile.displayName || profile.handle),
        body: clean,
        mediaUrl: mediaPreview,
        mediaName,
        slaps: 0,
        fdrops: 0,
        replies: [],
        createdAt: "Now",
      },
      ...current,
    ]);
    setDraft("");
    setMediaPreview(undefined);
    setMediaName(undefined);
    setToast("Bantr posted to Boks vs ABs");
    setView("feed");
  }

  function react(postId: number, type: "slap" | "fdrop") {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              slaps: type === "slap" ? post.slaps + 1 : post.slaps,
              fdrops: type === "fdrop" ? post.fdrops + 1 : post.fdrops,
            }
          : post,
      ),
    );
  }

  function reply(postId: number) {
    const clean = replyDrafts[postId]?.trim();
    if (!clean) return;
    setPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, replies: [...post.replies, clean] } : post,
      ),
    );
    setReplyDrafts((current) => ({ ...current, [postId]: "" }));
    setToast("Reply added");
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

  return (
    <main className="bantrboks-shell">
      <section className="phone-frame" aria-label="Bantrboks launch web app">
        <header className="app-header">
          <Brand />
          <button className="profile-dot" onClick={() => setView("profile")} aria-label="Open profile">
            {initials(profile.displayName || profile.handle)}
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
              clearPost={() => {
                setDraft("");
                setMediaPreview(undefined);
                setMediaName(undefined);
                setToast("Draft cleared");
              }}
            />
          )}

          {view === "ladder" && <Ladder ladder={ladder} />}

          {view === "profile" && (
            <Profile profile={profile} setProfile={setProfile} postCount={posts.length} />
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
        <h2>
          Bantrboks is the Boks vs ABs room, ready for launch.
        </h2>
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
  replyDrafts,
  setReplyDrafts,
  onReact,
  onReply,
  onShare,
}: {
  posts: BantrPost[];
  replyDrafts: Record<number, string>;
  setReplyDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onReact: (postId: number, type: "slap" | "fdrop") => void;
  onReply: (postId: number) => void;
  onShare: (post: BantrPost) => void;
}) {
  return (
    <section className="feed-stack">
      <div className="room-strip">
        <MiniRoomCard title="Boks pressure" handle="@bokrage" />
        <MiniRoomCard title="ABs receipts" handle="@hakaheat" accent="green" />
        <MiniRoomCard title="Scrum court" handle="@scrumcourt" accent="cyan" />
      </div>

      {posts.map((post, index) => (
        <article className={`post-card theme-${index % 4}`} key={post.id}>
          <PostHeader post={post} />
          <p className="room-hash">{room.hash}</p>
          {post.body && <p className="post-body">{post.body}</p>}
          <p className="tag">#bantrboks</p>
          <MediaBlock post={post} />
          <p className="open-hint">Tap to open full bantr</p>
          <div className="reaction-grid">
            <button onClick={() => onReact(post.id, "slap")}>👋 <span>SLAP</span><strong>{post.slaps}</strong></button>
            <button onClick={() => onReact(post.id, "fdrop")}>🔥 <span>F Drop</span><strong>{post.fdrops}</strong></button>
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
              {post.replies.slice(-3).map((replyText, replyIndex) => (
                <p key={`${post.id}-${replyIndex}`}>
                  <strong>@bantrfan</strong> {replyText}
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
  clearPost,
}: {
  draft: string;
  setDraft: (value: string) => void;
  mediaPreview?: string;
  mediaName?: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleMedia: (event: ChangeEvent<HTMLInputElement>) => void;
  createPost: () => void;
  clearPost: () => void;
}) {
  return (
    <section className="create-stack">
      {(draft || mediaPreview) && (
        <div className="preview-card">
          <h2>Preview</h2>
          {mediaPreview ? (
            <img src={mediaPreview} alt={mediaName ?? "Selected media"} />
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
          maxLength={180}
          rows={draft.length > 80 ? 4 : 2}
          placeholder="What do you want to bantr about?"
        />
        <span>{room.hash}</span>
        <strong>{draft.length}/180</strong>
      </label>

      <div className="tool-row">
        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleMedia} hidden />
        <button onClick={() => fileInputRef.current?.click()}>Gallery</button>
        <button onClick={() => fileInputRef.current?.click()}>Upload</button>
        <button>Voice later</button>
      </div>

      <div className="launch-note">
        <h2>Locked room</h2>
        <p>Every post goes into {room.name}. No room picker needed for this launch version.</p>
      </div>

      <button className="primary-action" onClick={createPost}>Post</button>
      <button className="danger-action" onClick={clearPost}>Discard post</button>
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
        <button>Combined later</button>
      </div>
      {ladder.map((row, index) => (
        <article className={`ladder-row row-${index}`} key={row.handle}>
          <span className="rank">{index + 1}</span>
          <span className="avatar">{row.avatar}</span>
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
}: {
  profile: { handle: string; displayName: string; email: string };
  setProfile: React.Dispatch<React.SetStateAction<{ handle: string; displayName: string; email: string }>>;
  postCount: number;
}) {
  return (
    <section className="profile-stack">
      <div className="profile-card">
        <span className="avatar big">{initials(profile.displayName || profile.handle)}</span>
        <h2>{profile.handle}</h2>
        <p>{profile.displayName}</p>
        <div className="profile-stats">
          <span>{postCount}<small>bantrs</small></span>
          <span>{room.left}<small>side</small></span>
          <span>{room.right}<small>rival</small></span>
        </div>
      </div>
      <label>
        Display name
        <input
          value={profile.displayName}
          onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))}
        />
      </label>
      <label>
        Handle
        <input
          value={profile.handle}
          onChange={(event) => setProfile((current) => ({ ...current, handle: normalizeHandle(event.target.value) }))}
        />
      </label>
      <label>
        Email
        <input
          value={profile.email}
          onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
          placeholder="you@example.com"
        />
      </label>
      <button className="primary-action">Join Bantrboks</button>
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
  if (post.mediaUrl) {
    return (
      <div className="media-frame">
        <img src={post.mediaUrl} alt={post.mediaName ?? "Bantr media"} />
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
      <span className="avatar">{post.avatar}</span>
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

function initials(value: string) {
  return value.replace("@", "").split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase() || "BB";
}

function normalizeHandle(value: string) {
  const clean = value.trim().replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, "");
  return clean ? `@${clean}` : "@";
}

function viewTitle(view: View) {
  if (view === "feed") return "Bantr";
  if (view === "create") return "Create";
  if (view === "ladder") return "Ladder";
  return "Profile";
}
