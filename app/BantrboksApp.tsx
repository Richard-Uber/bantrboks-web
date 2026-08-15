"use client";

import { ChangeEvent, Dispatch, FormEvent, ReactNode, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
type AccountMembership = {
  profile: Profile;
  role: "owner" | "admin" | "editor";
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
type CommentThreadNode = {
  comment: Comment;
  displayBody: string;
  parentHandle: string | null;
  replies: CommentThreadNode[];
};
type ThreadedComment = {
  comment: Comment;
  depth: number;
  displayBody: string;
  parentHandle: string | null;
};
type Reaction = {
  id: string;
  post_id: string;
  user_id: string;
  reaction: "slap" | "mic";
};
type NotificationRow = {
  id: string;
  title: string | null;
  body: string;
  kind: string | null;
  post_id: string | null;
  comment_id: string | null;
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
type LinkPreviewData = {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
  embedPlatform?: "x" | "facebook" | null;
};

const roomName = "Springboks vs All Blacks";
const roomSlug = "springboksvsallblacks";
const roomTags = [roomName, roomSlug];
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

function normaliseHandle(value: string) {
  return value
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
}

function firstPostUrl(body: string) {
  const match = body.match(/https?:\/\/[^\s<]+/i);
  return match?.[0]?.replace(/[),.!?;:'\"]+$/, "") ?? "";
}

function postTextWithoutUrls(body: string) {
  return body
    .replace(/https?:\/\/[^\s<]+/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function LinkifiedText({ text }: { text: string }) {
  const output: ReactNode[] = [];
  const pattern = /https?:\/\/[^\s<]+/gi;
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const rawUrl = match[0];
    const url = rawUrl.replace(/[),.!?;:'\"]+$/, "");
    const punctuation = rawUrl.slice(url.length);

    if (index > cursor) output.push(text.slice(cursor, index));
    output.push(
      <a key={`${index}-${url}`} href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>
    );
    if (punctuation) output.push(punctuation);
    cursor = index + rawUrl.length;
  }

  if (cursor < text.length) output.push(text.slice(cursor));
  return <>{output.length ? output : text}</>;
}

function LinkPreview({ body }: { body: string }) {
  const url = useMemo(() => firstPostUrl(body), [body]);
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!url) {
      setPreview(null);
      setLoaded(true);
      return;
    }

    const controller = new AbortController();
    setLoaded(false);
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Preview unavailable");
        return response.json() as Promise<LinkPreviewData>;
      })
      .then((data) => setPreview(data))
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setPreview(null);
      })
      .finally(() => setLoaded(true));

    return () => controller.abort();
  }, [url]);

  if (!url || (!loaded && !preview)) return null;

  let domain = url;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // Retain the original address for the fallback label.
  }

  return (
    <>
      {preview?.embedPlatform === "x" ? (
        <iframe
          className={`bb-social-embed bb-social-embed-${preview.embedPlatform}`}
          src={`/api/social-embed?url=${encodeURIComponent(preview.url || url)}`}
          title={`${preview.siteName || domain} post preview`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      ) : (
        <a className="bb-link-preview" href={preview?.url || url} target="_blank" rel="noopener noreferrer">
          {preview?.image ? <img src={preview.image} alt="" loading="lazy" /> : null}
          <span>
            <small>{preview?.siteName || domain}</small>
            <strong>{preview?.title || `View content on ${domain}`}</strong>
            {preview?.description ? <em>{preview.description}</em> : null}
            <b>Open link <span aria-hidden="true">↗</span></b>
          </span>
        </a>
      )}
    </>
  );
}

function parseCommentReply(body: string) {
  const match = body.match(/^\[\[reply:([^\]]+)\]\]\s*/);
  return {
    parentId: match?.[1] ?? null,
    displayBody: match ? body.slice(match[0].length) : body,
  };
}

function threadComments(comments: Comment[]): ThreadedComment[] {
  const ordered = [...comments].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
  const nodes: Array<CommentThreadNode & { parentId: string | null }> = ordered.map((comment) => {
    const parsed = parseCommentReply(comment.body);
    return {
      comment,
      displayBody: parsed.displayBody,
      parentHandle: null,
      replies: [],
      parentId: parsed.parentId,
    };
  });
  const nodesById = new Map<string, CommentThreadNode>(
    nodes.map((node): [string, CommentThreadNode] => [node.comment.id, node])
  );
  const lastCommentByHandle = new Map<string, CommentThreadNode>();
  const roots: CommentThreadNode[] = [];

  for (const node of nodes) {
    let parent: CommentThreadNode | undefined = node.parentId
      ? nodesById.get(node.parentId)
      : undefined;

    if (!parent && !node.parentId) {
      const mentionedHandle = node.displayBody.match(/^@([^\s]+)\s+/)?.[1]?.toLowerCase();
      if (mentionedHandle) parent = lastCommentByHandle.get(mentionedHandle);
    }

    if (parent && parent !== node) {
      node.parentHandle = cleanHandle(parent.comment.profiles);
      parent.replies.push(node);
    } else {
      roots.push(node);
    }

    const authorHandle = node.comment.profiles?.handle?.toLowerCase();
    if (authorHandle) lastCommentByHandle.set(authorHandle, node);
  }

  const flattened: ThreadedComment[] = [];
  function addNode(node: CommentThreadNode, depth: number) {
    flattened.push({
      comment: node.comment,
      depth,
      displayBody: node.displayBody,
      parentHandle: node.parentHandle,
    });
    node.replies.forEach((reply) => addNode(reply, depth + 1));
  }

  roots.slice(-4).forEach((root) => addNode(root, 0));
  return flattened;
}

async function sharePost(post: Post) {
  const postText = postTextWithoutUrls(post.body);
  const postUrl = new URL(`/post/${encodeURIComponent(post.id)}`, window.location.origin).href;
  const text = [postText, roomHash].filter(Boolean).join("\n\n");

  if (!navigator.share) return false;

  try {
    await navigator.share({
      title: `${cleanHandle(post.profiles)} on Bantrboks`,
      text,
      url: postUrl,
    });
    return true;
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
    return false;
  }
}

function sharedPostUrl(postId: string) {
  return new URL(`/post/${encodeURIComponent(postId)}`, window.location.origin).href;
}

async function copyPostLink(postId: string) {
  const url = sharedPostUrl(postId);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  const input = document.createElement("textarea");
  input.value = url;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function sharePostToFacebook(postId: string) {
  const url = sharedPostUrl(postId);
  window.open(
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    "bantrboks-facebook-share",
    "popup=yes,width=720,height=680,noopener,noreferrer"
  );
}

function sharePostToX(post: Post) {
  const url = sharedPostUrl(post.id);
  const take = postTextWithoutUrls(post.body);
  const text = [take, roomHash].filter(Boolean).join("\n\n");
  const intent = new URL("https://x.com/intent/post");
  intent.searchParams.set("url", url);
  if (text) intent.searchParams.set("text", text);
  window.open(intent.href, "bantrboks-x-share", "popup=yes,width=720,height=680,noopener,noreferrer");
}

async function sharePostToInstagram(post: Post) {
  const url = sharedPostUrl(post.id);
  const take = postTextWithoutUrls(post.body);
  const text = [take, roomHash, url].filter(Boolean).join("\n\n");

  if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
    await navigator.share({
      title: `${cleanHandle(post.profiles)} on Bantrboks`,
      text: [take, roomHash].filter(Boolean).join("\n\n"),
      url,
    });
    return "shared" as const;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    await copyPostLink(post.id);
  }
  window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  return "copied" as const;
}

export function BantrboksApp({ session }: { session: Session }) {
  const [view, setView] = useState<View>("home");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<AccountMembership[]>([]);
  const [activeProfileId, setActiveProfileId] = useState(session.user.id);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountHandle, setNewAccountHandle] = useState("");
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileHandleDraft, setProfileHandleDraft] = useState("");
  const [viewedProfile, setViewedProfile] = useState<Profile | null>(null);
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

  const loadAccounts = useCallback(async () => {
    await supabase.rpc("ensure_personal_account");

    const { data: membershipRows, error: membershipError } = await supabase
      .from("account_memberships")
      .select("profile_id, role")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true });

    if (membershipError || !membershipRows?.length) {
      const { data: personalProfile } = await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar, bio")
        .eq("id", session.user.id)
        .maybeSingle();
      if (personalProfile) {
        setAccounts([{ profile: personalProfile as Profile, role: "owner" }]);
        setActiveProfileId(session.user.id);
      }
      return;
    }

    const profileIds = membershipRows.map((membership) => membership.profile_id as string);
    const { data: managedProfiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar, bio")
      .in("id", profileIds);
    const profilesById = new Map(
      (managedProfiles ?? []).map((managedProfile) => [managedProfile.id, managedProfile as Profile])
    );
    const nextAccounts = membershipRows.flatMap((membership) => {
      const managedProfile = profilesById.get(membership.profile_id as string);
      return managedProfile
        ? [{ profile: managedProfile, role: membership.role as AccountMembership["role"] }]
        : [];
    });

    setAccounts(nextAccounts);
    const savedProfileId = window.localStorage.getItem(`bantrbox-active-profile:${session.user.id}`);
    const nextProfileId = nextAccounts.some((account) => account.profile.id === savedProfileId)
      ? savedProfileId!
      : nextAccounts[0]?.profile.id ?? session.user.id;
    setActiveProfileId(nextProfileId);
  }, [session.user.id]);

  const loadData = useCallback(async () => {
    const [profileRes, postsRes, commentsRes, reactionsRes, notificationsRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, handle, display_name, avatar, bio")
          .eq("id", activeProfileId)
          .maybeSingle(),
        supabase
          .from("posts")
          .select("id, author_id, body, tags, media_url, audio_url, created_at, profiles(id, handle, display_name, avatar, bio)")
          .overlaps("tags", roomTags)
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
          .select("id, title, body, kind, post_id, comment_id, read_at, created_at")
          .eq("user_id", activeProfileId)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (postsRes.data) setPosts(postsRes.data as unknown as Post[]);
    if (commentsRes.data) setComments(commentsRes.data as unknown as Comment[]);
    if (reactionsRes.data) setReactions(reactionsRes.data as Reaction[]);
    if (notificationsRes.data) setNotifications(notificationsRes.data as NotificationRow[]);
  }, [activeProfileId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setProfileNameDraft(profile?.display_name ?? "");
    setProfileHandleDraft(profile?.handle ?? "");
  }, [profile?.id, profile?.display_name, profile?.handle]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications]
  );

  async function markNotificationRead(notificationId: string) {
    const notification = notifications.find((item) => item.id === notificationId);
    if (notification?.read_at) return;
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", notificationId)
      .eq("user_id", activeProfileId);
    if (error) {
      setStatus(`Notification did not update: ${error.message}`);
      return;
    }
    setNotifications((current) => current.map((notification) => (
      notification.id === notificationId ? { ...notification, read_at: readAt } : notification
    )));
  }

  async function openNotification(notification: NotificationRow) {
    await markNotificationRead(notification.id);
    if (!notification.post_id) return;

    setView("home");
    window.setTimeout(() => {
      document.getElementById(`post-${notification.post_id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
  }

  async function markAllNotificationsRead() {
    const unreadIds = notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);
    if (!unreadIds.length) return;
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", activeProfileId)
      .in("id", unreadIds);
    if (error) {
      setStatus(`Notifications did not update: ${error.message}`);
      return;
    }
    setNotifications((current) => current.map((notification) => (
      unreadIds.includes(notification.id) ? { ...notification, read_at: readAt } : notification
    )));
  }

  function openLadderProfile(rowProfile?: Profile | null) {
    if (!rowProfile) return;
    setViewedProfile(rowProfile);
  }

  function switchAccount(profileId: string) {
    const nextAccount = accounts.find((account) => account.profile.id === profileId);
    if (!nextAccount) return;
    window.localStorage.setItem(`bantrbox-active-profile:${session.user.id}`, profileId);
    setActiveProfileId(profileId);
    setProfile(nextAccount.profile);
    setAccountMenuOpen(false);
    setCreateAccountOpen(false);
    setStatus(`Now using ${cleanHandle(nextAccount.profile)}.`);
  }

  async function createManagedAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const handle = newAccountHandle
      .trim()
      .replace(/^@+/, "")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .toLowerCase();
    if (!newAccountName.trim() || !handle) {
      setStatus("Add a display name and handle for the new account.");
      return;
    }

    setBusy("account");
    const { data, error } = await supabase.rpc("create_managed_profile", {
      p_display_name: newAccountName.trim(),
      p_handle: handle,
    });
    setBusy("");
    if (error) {
      setStatus(error.message);
      return;
    }

    setNewAccountName("");
    setNewAccountHandle("");
    await loadAccounts();
    if (typeof data === "string") {
      window.localStorage.setItem(`bantrbox-active-profile:${session.user.id}`, data);
      setActiveProfileId(data);
    }
    setCreateAccountOpen(false);
    setAccountMenuOpen(false);
    setStatus("New Bantrbox account created and selected.");
  }

  useEffect(() => {
    const channel = supabase.channel(roomChannelName);
    chatChannel.current = channel;

    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        setChatMessages((current) => [...current, payload as ChatMessage].slice(-80));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        void loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => {
        void loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions" }, () => {
        void loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${activeProfileId}` }, () => {
        void loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      chatChannel.current = null;
    };
  }, [loadData]);

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
    const path = `${folder}/${activeProfileId}/${Date.now()}.${safeExt}`;
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
      const { error } = await supabase.from("profiles").update({ avatar: publicUrl }).eq("id", activeProfileId);
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

  async function updateProfileIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = profileNameDraft.trim();
    const handle = normaliseHandle(profileHandleDraft);

    if (!displayName) {
      setStatus("Add a profile name.");
      return;
    }
    if (!handle || handle.length > 30) {
      setStatus("Choose a handle of 30 characters or fewer using letters, numbers or underscores.");
      return;
    }

    setBusy("profile");
    setStatus("");

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, handle })
      .eq("id", activeProfileId);

    if (error) {
      setBusy("");
      const isHandleConflict = error.code === "23505" || /duplicate|unique|handle/i.test(error.message);
      setStatus(isHandleConflict ? "That handle is already taken. Try another one." : `Profile did not update: ${error.message}`);
      return;
    }

    const nextProfile = profile ? { ...profile, display_name: displayName, handle } : profile;
    setProfile(nextProfile);
    setAccounts((current) => current.map((account) => (
      account.profile.id === activeProfileId
        ? { ...account, profile: { ...account.profile, display_name: displayName, handle } }
        : account
    )));
    setBusy("");
    setStatus("Profile name and handle updated.");
    await loadData();
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
        author_id: activeProfileId,
        body,
        tags: [...roomTags, "bantrbox"],
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
      (item) => item.post_id === postId && item.user_id === activeProfileId && item.reaction === reaction
    );

    const result = existing
      ? await supabase.from("post_reactions").delete().eq("id", existing.id)
      : await supabase.from("post_reactions").insert({
          id: `${postId}-${reaction}-${activeProfileId}`,
          post_id: postId,
          user_id: activeProfileId,
          reaction,
        });

    setBusy("");
    if (result.error) {
      setStatus(result.error.message);
      return;
    }
    loadData();
  }

  async function addComment(postId: string, replyToId?: string) {
    const body = commentDrafts[postId]?.trim();
    if (!body) return false;

    setBusy(`comment-${postId}`);
    const { error } = await supabase.from("comments").insert({
      id: `${Date.now()}-${postId}`,
      post_id: postId,
      author_id: activeProfileId,
      body: replyToId ? `[[reply:${replyToId}]]${body}` : body,
    });
    setBusy("");

    if (error) {
      setStatus(error.message);
      return false;
    }

    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
    loadData();
    return true;
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chatDraft.trim() || !chatChannel.current) return;

    const message: ChatMessage = {
      id: `${Date.now()}-${activeProfileId}`,
      userId: activeProfileId,
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
        <img className="bb-app-logo" src="/bantrboks-logo.webp" alt="Bantrboks" />
        <button
          className="bb-profile-dot"
          type="button"
          aria-label={`Account menu. Currently ${cleanHandle(profile)}`}
          aria-expanded={accountMenuOpen}
          onClick={() => setAccountMenuOpen((open) => !open)}
        >
          <Avatar profile={profile} />
        </button>
      </header>

      {accountMenuOpen ? (
        <div className="bb-account-backdrop" role="presentation" onMouseDown={() => setAccountMenuOpen(false)}>
          <section className="bb-account-switcher" role="dialog" aria-modal="true" aria-labelledby="account-switcher-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>Signed in as {session.user.email}</small>
                <h2 id="account-switcher-title">Switch Bantrbox account</h2>
              </div>
              <button type="button" aria-label="Close account menu" onClick={() => setAccountMenuOpen(false)}>×</button>
            </header>
            <div className="bb-account-list">
              {accounts.map((account) => (
                <button
                  className={account.profile.id === activeProfileId ? "is-active" : undefined}
                  key={account.profile.id}
                  type="button"
                  onClick={() => switchAccount(account.profile.id)}
                >
                  <Avatar profile={account.profile} />
                  <span>
                    <strong>{cleanHandle(account.profile)}</strong>
                    <small>{account.profile.display_name || "Bantrbox account"} · {account.role}</small>
                  </span>
                  <b aria-hidden="true">{account.profile.id === activeProfileId ? "✓" : ""}</b>
                </button>
              ))}
            </div>
            {createAccountOpen ? (
              <form className="bb-account-create" onSubmit={createManagedAccount}>
                <h3>Create another Bantrbox account</h3>
                <input value={newAccountName} onChange={(event) => setNewAccountName(event.target.value)} placeholder="Display name" maxLength={80} autoFocus />
                <input value={newAccountHandle} onChange={(event) => setNewAccountHandle(event.target.value)} placeholder="Handle" maxLength={30} />
                <div>
                  <button type="button" onClick={() => setCreateAccountOpen(false)}>Cancel</button>
                  <button type="submit" disabled={busy === "account"}>{busy === "account" ? "Creating..." : "Create account"}</button>
                </div>
              </form>
            ) : (
              <button className="bb-add-account" type="button" onClick={() => setCreateAccountOpen(true)}>+ Create another Bantrbox account</button>
            )}
            <button
              className="bb-switcher-profile"
              type="button"
              onClick={() => {
                setView("profile");
                setAccountMenuOpen(false);
              }}
            >
              View active profile
            </button>
            <button className="bb-switcher-signout" type="button" onClick={signOut}>Sign out of all accounts</button>
          </section>
        </div>
      ) : null}

      <BantrboksTagline />

      <section className="bb-room-hero">
        <a className="bb-room-byline" href="https://bantrbox.com" target="_blank" rel="noreferrer">
          By Bantrbox.com
        </a>
        <img src="/brand/bantrboks-room-rivalry-v3.webp" alt="BOKS vs ABS Bantrboks room" />
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
                <button className="bb-ladder-row" key={row.id} type="button" onClick={() => openLadderProfile(row.profile)}>
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
            <header className="bb-notification-header">
              <h2>Room notifications</h2>
              {unreadNotificationCount ? <button type="button" onClick={markAllNotificationsRead}>Mark all read</button> : null}
            </header>
            {notifications.length ? notifications.map((item) => (
              <button
                className={`bb-notification${item.read_at ? "" : " is-unread"}`}
                key={item.id}
                type="button"
                onClick={() => openNotification(item)}
              >
                <strong>{item.title || item.kind || "Bantrboks"}</strong>
                <p>{item.body}</p>
                <small>{formatAge(item.created_at)}</small>
              </button>
            )) : <p className="bb-muted">No notifications yet. Replies, slaps and Drops from this room will show here.</p>}
          </section>
        ) : null}

        {view === "chat" ? (
          <section className="bb-card bb-chat">
            <h2>Live room chat</h2>
            <p className="bb-muted">Live chat is available for this Bantrboks room. Messages are live only and are not stored.</p>
            <div className="bb-chat-window">
              {chatMessages.length ? chatMessages.map((message) => (
                <div className={message.userId === activeProfileId ? "is-mine" : undefined} key={message.id}>
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
            <p className="bb-master-email">Managed by {session.user.email}</p>
            <form className="bb-profile-edit" onSubmit={updateProfileIdentity}>
              <label>
                Profile name
                <input
                  value={profileNameDraft}
                  onChange={(event) => setProfileNameDraft(event.target.value)}
                  placeholder="Profile name"
                  maxLength={60}
                  autoComplete="name"
                />
              </label>
              <label>
                Handle
                <span className="bb-handle-input">
                  <b aria-hidden="true">@</b>
                  <input
                    value={profileHandleDraft}
                    onChange={(event) => setProfileHandleDraft(normaliseHandle(event.target.value))}
                    placeholder="yourhandle"
                    maxLength={30}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </span>
              </label>
              <button className="bb-primary" type="submit" disabled={busy === "profile"}>
                {busy === "profile" ? "Saving..." : "Save profile"}
              </button>
            </form>
            {accounts.length > 1 ? (
              <button className="bb-secondary" type="button" onClick={() => setAccountMenuOpen(true)}>Switch account</button>
            ) : null}
            <button className="bb-secondary" type="button" onClick={() => avatarInput.current?.click()} disabled={busy === "avatar"}>
              {busy === "avatar" ? "Updating..." : "Change profile picture"}
            </button>
            {profile?.bio ? <p className="bb-bio">{profile.bio}</p> : null}
            <button className="bb-secondary" type="button" onClick={signOut}>Sign out</button>
          </section>
        ) : null}

        {viewedProfile ? (
          <div className="bb-public-profile-backdrop" role="presentation" onMouseDown={() => setViewedProfile(null)}>
            <section className="bb-public-profile" role="dialog" aria-modal="true" aria-labelledby="ladder-profile-title" onMouseDown={(event) => event.stopPropagation()}>
              <button className="bb-public-profile-close" type="button" aria-label="Close participant profile" onClick={() => setViewedProfile(null)}>×</button>
              <Avatar profile={viewedProfile} className="large" />
              <h2 id="ladder-profile-title">{cleanHandle(viewedProfile)}</h2>
              <p>{viewedProfile.display_name || "Bantrboks user"}</p>
              {viewedProfile.bio ? <p className="bb-bio">{viewedProfile.bio}</p> : null}
              <small>Bantrboks ladder participant</small>
            </section>
          </div>
        ) : null}
      </section>

      <nav className="bb-bottom-nav" aria-label="Bantrboks navigation">
        {navButton("home", "Home", "⌂")}
        {navButton("ranking", "Ranking", "🏆")}
        {navButton("create", "Create", "+")}
        <button className={view === "notifications" ? "is-active" : undefined} onClick={() => setView("notifications")} type="button">
          <span className="bb-nav-notification-icon" aria-hidden="true">●{unreadNotificationCount ? <b>{Math.min(unreadNotificationCount, 99)}</b> : null}</span>
          Notifs
        </button>
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
  addComment: (postId: string, replyToId?: string) => Promise<boolean>;
  commentDrafts: Record<string, string>;
  setCommentDrafts: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  const [sharingPostId, setSharingPostId] = useState("");
  const [shareMenuPostId, setShareMenuPostId] = useState("");
  const [copiedPostId, setCopiedPostId] = useState("");
  const [replyTargets, setReplyTargets] = useState<Record<string, Comment | null>>({});
  const commentInputs = useRef<Record<string, HTMLInputElement | null>>({});

  function cancelReply(postId: string) {
    const replyTo = replyTargets[postId];
    const mention = replyTo ? `${cleanHandle(replyTo.profiles)} ` : "";
    setReplyTargets((current) => ({ ...current, [postId]: null }));
    if (mention) {
      setCommentDrafts((current) => {
        const draft = current[postId] || "";
        return {
          ...current,
          [postId]: draft.startsWith(mention) ? draft.slice(mention.length) : draft,
        };
      });
    }
  }

  function focusComment(postId: string, replyTo?: Comment) {
    if (replyTo) {
      setReplyTargets((current) => ({ ...current, [postId]: replyTo }));
      const mention = `${cleanHandle(replyTo.profiles)} `;
      setCommentDrafts((current) => ({
        ...current,
        [postId]: current[postId]?.trim() ? current[postId] : mention,
      }));
    } else {
      cancelReply(postId);
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
        const postComments = comments.filter((comment) => comment.post_id === post.id);
        const threadedComments = threadComments(postComments);
        const replyTarget = replyTargets[post.id];
        const postText = postTextWithoutUrls(post.body);
        return (
          <article className="bb-post" id={`post-${post.id}`} key={post.id}>
            <header>
              <Avatar profile={post.profiles} />
              <div>
                <strong>{cleanHandle(post.profiles)}</strong>
                <small>{post.profiles?.display_name || "Bantrboks user"} • {formatAge(post.created_at)}</small>
              </div>
            </header>
            <span className="bb-tag">{roomHash}</span>
            {postText ? <p className="bb-post-body"><LinkifiedText text={postText} /></p> : null}
            <LinkPreview body={post.body} />
            {post.media_url ? <img className="bb-post-media" src={post.media_url} alt="Bantr media" /> : null}
            {post.audio_url ? <audio className="bb-post-audio" src={post.audio_url} controls /> : null}
            <div className="bb-actions">
              <button type="button" onClick={() => react(post.id, "slap")} disabled={busy === `${post.id}-slap`}>👋 Slap <b>{stats.slap}</b></button>
              <button type="button" onClick={() => react(post.id, "mic")} disabled={busy === `${post.id}-mic`}>🔥 Drop <b>{stats.mic}</b></button>
              <button type="button" onClick={() => focusComment(post.id)}>💬 Reply <b>{stats.comments}</b></button>
              <button
                type="button"
                disabled={sharingPostId === post.id}
                onClick={async () => {
                  const prefersNativeShare = window.matchMedia("(pointer: coarse)").matches && Boolean(navigator.share);
                  if (prefersNativeShare) {
                    setSharingPostId(post.id);
                    try {
                      await sharePost(post);
                    } finally {
                      setSharingPostId("");
                    }
                  } else {
                    setShareMenuPostId((current) => current === post.id ? "" : post.id);
                  }
                }}
                aria-expanded={shareMenuPostId === post.id}
              >
                {sharingPostId === post.id ? "Preparing…" : "Share"}
              </button>
            </div>
            {shareMenuPostId === post.id ? (
              <div className="bb-share-menu" role="group" aria-label="Share this Bantrboks post">
                <button
                  type="button"
                  onClick={async () => {
                    await copyPostLink(post.id);
                    setCopiedPostId(post.id);
                    window.setTimeout(() => setCopiedPostId(""), 2200);
                  }}
                >
                  {copiedPostId === post.id ? "✓ Link copied" : "Copy link"}
                </button>
                <button type="button" onClick={() => sharePostToFacebook(post.id)}>
                  Share to Facebook
                </button>
                <button type="button" onClick={() => sharePostToX(post)}>
                  Share to X
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const result = await sharePostToInstagram(post);
                    if (result === "copied") {
                      setCopiedPostId(post.id);
                      window.setTimeout(() => setCopiedPostId(""), 2200);
                    }
                  }}
                >
                  {copiedPostId === post.id ? "✓ Copied for Instagram" : "Share to Instagram"}
                </button>
              </div>
            ) : null}
            <div className="bb-comments">
              {threadedComments.map(({ comment, depth, displayBody, parentHandle }) => (
                <article
                  className={`bb-comment${depth ? " is-reply" : ""}`}
                  key={comment.id}
                  style={{ marginLeft: Math.min(depth, 3) * 18 }}
                >
                  <p>
                    {parentHandle ? <small>↳ Replying to {parentHandle}</small> : null}
                    <strong>{cleanHandle(comment.profiles)}</strong> {displayBody}
                  </p>
                  <button
                    type="button"
                    onClick={() => focusComment(post.id, comment)}
                    aria-label={`Reply to ${cleanHandle(comment.profiles)}`}
                  >
                    Reply
                  </button>
                </article>
              ))}
            </div>
            <form
              className="bb-comment-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const saved = await addComment(post.id, replyTarget?.id);
                if (saved) setReplyTargets((current) => ({ ...current, [post.id]: null }));
              }}
            >
              {replyTarget ? (
                <div className="bb-replying-to">
                  <span>Replying to {cleanHandle(replyTarget.profiles)}</span>
                  <button
                    type="button"
                    onClick={() => cancelReply(post.id)}
                    aria-label="Cancel reply"
                  >
                    ×
                  </button>
                </div>
              ) : null}
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
