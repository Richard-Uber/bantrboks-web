"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BantrboksAuth } from "../../BantrboksAuth";
import { pushBantrboksEvent, pushBantrboksEventOncePerAccount } from "../../bantrboksAnalytics";
import { supabase } from "../../supabase";
import type { CampaignTopic, TopicResponse } from "../topicTypes";

type Totals = Record<string, { slap: number; fire: number }>;
type Reaction = "slap" | "fire";

function profileInitials(response: TopicResponse) {
  return (response.profiles?.display_name || response.profiles?.handle || "BB").slice(0, 2).toUpperCase();
}

function visibleBody(body: string) {
  return body.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim() || "A rivalry take just dropped.";
}

export function TopicLanding({
  initialTopic,
  initialResponses,
  initialTotals,
}: {
  initialTopic: CampaignTopic;
  initialResponses: TopicResponse[];
  initialTotals: Totals;
}) {
  const storagePrefix = `bantrboks-topic:${initialTopic.slug}`;
  const [session, setSession] = useState<Session | null>(null);
  const [responses, setResponses] = useState(initialResponses);
  const [totals, setTotals] = useState(initialTotals);
  const [returnVisitor, setReturnVisitor] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [expired, setExpired] = useState(
    () => Date.now() >= new Date(initialTopic.expires_at).getTime() || initialTopic.status === "expired"
  );
  const authRef = useRef<HTMLElement>(null);

  const topicTarget = `topic:${initialTopic.id}`;
  const topicTotals = totals[topicTarget] || { slap: 0, fire: 0 };

  useEffect(() => {
    setDraft(window.localStorage.getItem(`${storagePrefix}:draft`) || "");
    const sessionId = crypto.randomUUID();
    void fetch(`/api/topics/${encodeURIComponent(initialTopic.slug)}/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ session_id: sessionId }),
    }).then((response) => response.ok ? response.json() : null)
      .then((data) => setReturnVisitor(Boolean(data?.return_visitor)))
      .catch(() => undefined);

    pushBantrboksEvent("topic_view", { topic_slug: initialTopic.slug });
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: auth } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => auth.subscription.unsubscribe();
  }, [initialTopic.slug, storagePrefix]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setExpired(Date.now() >= new Date(initialTopic.expires_at).getTime() || initialTopic.status === "expired");
    }, 1000);
    return () => window.clearInterval(timer);
  }, [initialTopic.expires_at, initialTopic.status]);

  useEffect(() => {
    window.localStorage.setItem(`${storagePrefix}:draft`, draft);
  }, [draft, storagePrefix]);

  const requireRegistration = useCallback((reason: string) => {
    window.localStorage.setItem(`${storagePrefix}:pending`, reason);
    pushBantrboksEvent("topic_registration_gate", { topic_slug: initialTopic.slug, gate_reason: reason });
    setMessage("Sign in to continue—your take is saved.");
    authRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialTopic.slug, storagePrefix]);

  async function waitForProfile(userId: string) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (data?.id) return true;
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    }
    return false;
  }

  const submitTake = useCallback(async (activeSession: Session) => {
    const body = (window.localStorage.getItem(`${storagePrefix}:draft`) || "").trim();
    if (!body || busy) return;
    setBusy("post");
    setMessage("");
    try {
      if (!await waitForProfile(activeSession.user.id)) throw new Error("Your profile is still being prepared. Please try again.");
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", activeSession.user.id);
      const postId = String(Date.now());
      const { error } = await supabase.from("posts").insert({
        id: postId,
        author_id: activeSession.user.id,
        body,
        tags: [initialTopic.room_name, initialTopic.room_slug, "bantrbox", `topic:${initialTopic.slug}`],
        topic_id: initialTopic.id,
        media_url: null,
        visibility: "Everyone",
      });
      if (error) throw error;
      if (count === 0) pushBantrboksEventOncePerAccount("first_post", activeSession.user.id, { post_id: postId });
      pushBantrboksEvent("topic_response", { topic_slug: initialTopic.slug, post_id: postId });
      const profile = await supabase.from("profiles").select("handle, display_name, avatar").eq("id", activeSession.user.id).maybeSingle();
      setResponses((current) => [{
        id: postId,
        author_id: activeSession.user.id,
        body,
        media_url: null,
        created_at: new Date().toISOString(),
        profiles: profile.data || null,
      }, ...current]);
      setDraft("");
      window.localStorage.removeItem(`${storagePrefix}:draft`);
      window.localStorage.removeItem(`${storagePrefix}:pending`);
      setMessage("Your take is live in the room.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your take could not be posted.");
    } finally {
      setBusy("");
    }
  }, [busy, initialTopic, storagePrefix]);

  useEffect(() => {
    if (!session || window.localStorage.getItem(`${storagePrefix}:pending`) !== "post") return;
    const timer = window.setTimeout(() => void submitTake(session), 700);
    return () => window.clearTimeout(timer);
  }, [session, storagePrefix, submitTake]);

  async function postTake() {
    if (expired) return;
    if (!draft.trim()) {
      document.getElementById("topic-draft")?.focus();
      setMessage("Write your take first.");
      return;
    }
    if (!session) {
      requireRegistration("post");
      return;
    }
    await submitTake(session);
  }

  async function react(targetKey: string, reaction: Reaction) {
    if (returnVisitor && !session) {
      requireRegistration(`reaction:${targetKey}`);
      return;
    }
    setBusy(`reaction:${targetKey}`);
    const token = session?.access_token;
    const response = await fetch(`/api/topics/${encodeURIComponent(initialTopic.slug)}/react`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "same-origin",
      body: JSON.stringify({ target_key: targetKey, reaction }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy("");
    if (data.registration_required) return requireRegistration(`reaction:${targetKey}`);
    if (!response.ok) return setMessage(data.error || "Reaction could not be saved.");
    setTotals((current) => ({ ...current, [targetKey]: data.totals }));
    pushBantrboksEvent("topic_reaction", { topic_slug: initialTopic.slug, reaction, target_key: targetKey });
  }

  async function shareTopic() {
    if (returnVisitor && !session) {
      requireRegistration("share");
      return;
    }
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: initialTopic.campaign_name, text: "Drop your take", url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      setMessage("Topic link copied.");
    }
    pushBantrboksEvent("topic_share", { topic_slug: initialTopic.slug, share_channel: "native" });
  }

  function startReply(postId: string) {
    if (!session) return requireRegistration(`reply:${postId}`);
    setReplyTarget(postId);
    setReplyDraft("");
  }

  async function sendReply(postId: string) {
    if (!session || !replyDraft.trim()) return;
    setBusy(`reply:${postId}`);
    const { error } = await supabase.from("comments").insert({
      id: `${Date.now()}-${postId}`,
      post_id: postId,
      author_id: session.user.id,
      body: replyDraft.trim(),
    });
    setBusy("");
    if (error) return setMessage(error.message);
    setReplyDraft("");
    setReplyTarget(null);
    setMessage("Your reply is live.");
    pushBantrboksEvent("reply_created", { post_id: postId, topic_slug: initialTopic.slug });
  }

  const countdown = useMemo(() => new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(initialTopic.expires_at)), [initialTopic.expires_at]);

  if (expired) {
    return (
      <main className="topic-expired">
        <img src="/bantrboks-logo.webp" alt="Bantrboks" />
        <h1>This live topic has closed.</h1>
        <p>The rivalry continues in the Springboks vs All Blacks room.</p>
        <a href={initialTopic.redirect_path}>Enter the room</a>
      </main>
    );
  }

  return (
    <main className="topic-page">
      <header className="topic-header">
        <a href="/"><img src="/bantrboks-logo.webp" alt="Bantrboks" /></a>
        <span><i /> LIVE TOPIC</span>
      </header>

      <section className="topic-room-strip">
        <small>SPRINGBOKS VS ALL BLACKS</small>
        <strong>Rivalry room</strong>
      </section>

      <article className="topic-pinned">
        <div className="topic-pinned-label">PINNED QUESTION</div>
        <h1>{initialTopic.question}</h1>
        {initialTopic.media_url ? <img src={initialTopic.media_url} alt="All Blacks coaching approved campaign" /> : null}
        <div className="topic-actions">
          <button onClick={() => react(topicTarget, "slap")} disabled={busy === `reaction:${topicTarget}`}><span>👋</span><b>{topicTotals.slap}</b></button>
          <button onClick={() => react(topicTarget, "fire")} disabled={busy === `reaction:${topicTarget}`}><span>🔥</span><b>{topicTotals.fire}</b></button>
          <button onClick={shareTopic}><span>↗</span><b>Share</b></button>
        </div>
      </article>

      <section className="topic-compose">
        <h2>Drop your take</h2>
        <textarea
          id="topic-draft"
          value={draft}
          maxLength={280}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="What’s your take?"
        />
        <div><span>{draft.length}/280</span><button onClick={postTake} disabled={busy === "post"}>{busy === "post" ? "Posting…" : "Drop your take"}</button></div>
        {message ? <p className="topic-message" role="status">{message}</p> : null}
      </section>

      <section className="topic-responses">
        <div className="topic-section-title"><span>LIVE RESPONSES</span><b>{responses.length}</b></div>
        {responses.length ? responses.map((response) => {
          const targetKey = `post:${response.id}`;
          const responseTotals = totals[targetKey] || { slap: 0, fire: 0 };
          return (
            <article className="topic-response" key={response.id}>
              <div className="topic-response-author">
                {response.profiles?.avatar?.startsWith("http") ? <img src={response.profiles.avatar} alt="" /> : <span>{profileInitials(response)}</span>}
                <div><strong>@{response.profiles?.handle || "bantrboks"}</strong><small>{response.profiles?.display_name || "Bantrboks supporter"}</small></div>
              </div>
              <p>{visibleBody(response.body)}</p>
              {response.media_url ? <img className="topic-response-media" src={response.media_url} alt="" loading="lazy" /> : null}
              <div className="topic-response-actions">
                <button onClick={() => react(targetKey, "slap")}>👋 {responseTotals.slap}</button>
                <button onClick={() => react(targetKey, "fire")}>🔥 {responseTotals.fire}</button>
                <button onClick={() => startReply(response.id)}>💬 Reply</button>
              </div>
              {replyTarget === response.id ? <div className="topic-reply"><input value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} placeholder="Write a reply" /><button onClick={() => sendReply(response.id)} disabled={busy === `reply:${response.id}`}>Send</button></div> : null}
            </article>
          );
        }) : <p className="topic-empty">No takes yet. Be the first to challenge the room.</p>}
      </section>

      <section className="topic-auth" ref={authRef}>
        <h2>Join the rivalry</h2>
        <p>Your draft stays ready while you sign in.</p>
        <BantrboksAuth socialFirst collapsedManual />
      </section>

      <footer className="topic-footer">
        <span>Campaign closes {countdown} SAST</span>
        <nav><a href="https://bantrbox.com/privacy">Privacy</a><a href="https://bantrbox.com/terms">Terms</a><a href="/">Bantrboks</a></nav>
      </footer>
    </main>
  );
}
