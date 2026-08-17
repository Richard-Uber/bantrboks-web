"use client";

import { useEffect, useState } from "react";
import { BantrboksAuth } from "./BantrboksAuth";
import { captureBantrboksCampaignAttribution, pushBantrboksEvent } from "./bantrboksAnalytics";
import { supabase } from "./supabase";

const appStoreUrl = "https://apps.apple.com/app/bantrbox/id6791587145";
const playStoreUrl = "https://play.google.com/store/apps/details?id=com.bantrbox.app";

type LandingPost = {
  id: string;
  body: string;
  media_url: string | null;
  created_at: string;
  profiles: {
    handle: string | null;
    display_name: string | null;
    avatar: string | null;
  } | null;
};

type Side = "springboks" | "all_blacks";

function postText(body: string) {
  const withoutLinks = body.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
  return withoutLinks || "A new rivalry drop just hit.";
}

function profileInitials(post: LandingPost) {
  const label = post.profiles?.display_name || post.profiles?.handle || "BB";
  return label.slice(0, 2).toUpperCase();
}

function isVideo(url: string) {
  return /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(url);
}

const campaignHotspots = [
  { label: "Log in", href: "#account", className: "campaign-nav-login" },
  { label: "Download on the App Store", href: appStoreUrl, className: "campaign-app-store", external: true },
  { label: "Get it on Google Play", href: playStoreUrl, className: "campaign-play-store", external: true },
  { label: "Back the Boks", href: "#account", className: "campaign-back-boks" },
  { label: "Back the ABs", href: "#account", className: "campaign-back-abs" },
  { label: "Privacy Policy", href: "https://bantrbox.com/privacy", className: "campaign-footer-privacy", external: true },
  { label: "Terms and Conditions", href: "https://bantrbox.com/terms", className: "campaign-footer-terms", external: true },
  { label: "Community Guidelines", href: "https://bantrbox.com/community-guidelines", className: "campaign-footer-community", external: true },
  { label: "Safety Standards", href: "https://bantrbox.com/safety-standards", className: "campaign-footer-safety", external: true },
];

export function BantrboksLanding() {
  const [desktopLoginOpen, setDesktopLoginOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<Side | null>(null);
  const [livePosts, setLivePosts] = useState<LandingPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    captureBantrboksCampaignAttribution();

    let cancelled = false;
    supabase
      .from("posts")
      .select("id, body, media_url, created_at, profiles(handle, display_name, avatar)")
      .overlaps("tags", ["Springboks vs All Blacks", "springboksvsallblacks"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (cancelled) return;
        setLivePosts((data || []) as unknown as LandingPost[]);
        setFeedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function chooseSide(side: Side) {
    setSelectedSide(side);
    pushBantrboksEvent("choose_side", { side });
  }

  function showAccountOptions() {
    document.getElementById("mobile-account")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (!desktopLoginOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDesktopLoginOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [desktopLoginOpen]);

  return (
    <main className="approved-landing" id="app">
      <section className="approved-artboard" id="room" aria-label="Bantrboks Boks vs ABs landing page">
        <img
          className="campaign-artwork"
          src="/brand/bantrboks-rivalry-landing-v5.webp"
          alt="Bantrboks Boks vs ABs campaign: Drop your take. Back your side. Climb the board."
          draggable={false}
        />
        <img
          className="campaign-brand-logo"
          src="/bantrboks-logo.webp"
          alt="Bantrboks"
          draggable={false}
        />
        <a className="approved-division" href="https://bantrbox.com" target="_blank" rel="noreferrer">
          By Bantrbox.com
        </a>
        <h1 className="sr-only">Bantrboks</h1>
        <p className="sr-only">
          Boks versus ABs. Drop your take, back your side and climb the board.
        </p>
        {campaignHotspots.map((hotspot) => (
          <a
            key={`${hotspot.className}-${hotspot.href}`}
            aria-label={hotspot.label}
            className={`approved-hotspot ${hotspot.className}`}
            href={hotspot.href}
            onClick={hotspot.href === "#account" ? (event) => {
              event.preventDefault();
              if (hotspot.className === "campaign-back-boks") {
                pushBantrboksEvent("choose_side", { side: "springboks" });
              } else if (hotspot.className === "campaign-back-abs") {
                pushBantrboksEvent("choose_side", { side: "all_blacks" });
              }
              setDesktopLoginOpen(true);
            } : undefined}
            rel={hotspot.external ? "noreferrer" : undefined}
            target={hotspot.external ? "_blank" : undefined}
          />
        ))}
        <button
          className="desktop-login-button"
          type="button"
          onClick={() => setDesktopLoginOpen(true)}
          aria-haspopup="dialog"
        >
          Log in
        </button>
        <span id="account" className="campaign-anchor campaign-anchor-account" aria-hidden="true" />
      </section>
      <section className="mobile-landing" aria-label="Bantrboks mobile landing page">
        <header className="mobile-header">
          <img className="mobile-logo" src="/bantrboks-logo.webp" alt="Bantrboks" draggable={false} />
          <a className="mobile-division" href="https://bantrbox.com" target="_blank" rel="noreferrer">
            By Bantrbox.com
          </a>
        </header>

        <section className="mobile-rivalry-intro">
          <p className="mobile-live-kicker"><span aria-hidden="true" /> Rivalry room live</p>
          <h1>Springboks or All Blacks? Pick your side.</h1>
          <p>The rivalry is live. Read the latest predictions, challenge a supporter and drop your own take.</p>
          <div className="mobile-side-choice" aria-label="Pick your side">
            <button
              className={selectedSide === "springboks" ? "is-selected springboks" : "springboks"}
              type="button"
              aria-pressed={selectedSide === "springboks"}
              onClick={() => chooseSide("springboks")}
            >
              I’m backing the Springboks
            </button>
            <button
              className={selectedSide === "all_blacks" ? "is-selected all-blacks" : "all-blacks"}
              type="button"
              aria-pressed={selectedSide === "all_blacks"}
              onClick={() => chooseSide("all_blacks")}
            >
              I’m backing the All Blacks
            </button>
          </div>
        </section>

        <section className="mobile-room-entry" aria-label="Bantrboks room">
          <img
            className="mobile-room-poster"
            src="/brand/bantrboks-room-rivalry-v3.webp"
            alt="BOKS vs ABS Bantrboks room"
            draggable={false}
          />
        </section>

        <section className="mobile-live-feed" aria-labelledby="mobile-live-feed-title">
          <div className="mobile-live-feed-heading">
            <div>
              <span>Live from the room</span>
              <h2 id="mobile-live-feed-title">Latest rivalry takes</h2>
            </div>
            <span className="mobile-live-dot">Live</span>
          </div>
          {feedLoading ? (
            <div className="mobile-live-loading">Loading the latest takes…</div>
          ) : livePosts.length ? (
            <div className="mobile-live-posts">
              {livePosts.map((post) => (
                <a className="mobile-live-post" href={`/post/${post.id}`} key={post.id}>
                  <div className="mobile-live-post-author">
                    {post.profiles?.avatar?.startsWith("http") ? (
                      <img src={post.profiles.avatar} alt="" />
                    ) : (
                      <span>{profileInitials(post)}</span>
                    )}
                    <strong>@{post.profiles?.handle || "bantrboks"}</strong>
                  </div>
                  <p>{postText(post.body)}</p>
                  {post.media_url ? (
                    isVideo(post.media_url) ? (
                      <video src={post.media_url} muted playsInline preload="metadata" />
                    ) : (
                      <img className="mobile-live-post-media" src={post.media_url} alt="" loading="lazy" />
                    )
                  ) : null}
                </a>
              ))}
            </div>
          ) : (
            <div className="mobile-live-loading">The room is warming up. Be first to drop a take.</div>
          )}
        </section>

        <button className="mobile-post-take" type="button" onClick={showAccountOptions}>
          Post your take
        </button>

        <section className="mobile-account-section" id="mobile-account" aria-label="Join Bantrboks">
          <h2>Join the rivalry</h2>
          <p>Sign in to post, reply or react. Reading the live feed is always open.</p>
          <BantrboksAuth socialFirst collapsedManual />
        </section>

        <section className="mobile-hero">
          <div className="mobile-actions">
            <a href={appStoreUrl} target="_blank" rel="noreferrer" className="store-button apple">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16.4 12.7c0-2 1.6-3 1.7-3.1-1-.1-1.9-.6-2.4-1.3-1-.2-2 .6-2.6.6-.7 0-1.7-.6-2.7-.6-1.4 0-2.7.8-3.4 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7s1.8-1 2.5-2c.8-1.2 1.1-2.3 1.1-2.4-.1 0-2.2-.8-2.2-3Zm-2.1-5.4c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6.9.1 1.9-.5 2.5-1.2Z" />
              </svg>
              <span>
                <small>Download on the</small>
                App Store
              </span>
            </a>
            <a href={playStoreUrl} target="_blank" rel="noreferrer" className="store-button play">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#34a853" d="M4.2 3.6c-.2.2-.3.6-.3 1v14.8c0 .4.1.7.3 1l8.3-8.4-8.3-8.4Z" />
                <path fill="#fbbc04" d="m15.4 9.1-2.9 2.9 2.9 2.9 3.4-1.9c1.1-.6 1.1-1.4 0-2l-3.4-1.9Z" />
                <path fill="#4285f4" d="m4.2 3.6 8.3 8.4 2.9-2.9L5.8 3.7c-.7-.4-1.3-.4-1.6-.1Z" />
                <path fill="#ea4335" d="m4.2 20.4c.3.3.9.3 1.6-.1l9.6-5.4-2.9-2.9-8.3 8.4Z" />
              </svg>
              <span>
                <small>Get it on</small>
                Google Play
              </span>
            </a>
          </div>
        </section>

        <nav className="mobile-policy-links" aria-label="Bantrboks policies">
          <a href="https://bantrbox.com/privacy" target="_blank" rel="noreferrer">Privacy</a>
          <a href="https://bantrbox.com/terms" target="_blank" rel="noreferrer">Terms</a>
          <a href="https://bantrbox.com/community-guidelines" target="_blank" rel="noreferrer">Guidelines</a>
          <a href="https://bantrbox.com/safety-standards" target="_blank" rel="noreferrer">Safety</a>
          <a href="https://bantrbox.com/support" target="_blank" rel="noreferrer">Support</a>
        </nav>

        <a className="mobile-email" href="mailto:support@ubermobi.com">
          support@ubermobi.com
        </a>
      </section>

      {desktopLoginOpen ? (
        <div
          className="desktop-auth-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDesktopLoginOpen(false);
          }}
        >
          <section
            className="desktop-auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="desktop-auth-title"
          >
            <header>
              <div>
                <img src="/bantrboks-logo.webp" alt="Bantrboks" />
                <h2 id="desktop-auth-title">Welcome back</h2>
                <p>Log in to enter the Bantrboks feed.</p>
              </div>
              <button
                className="desktop-auth-close"
                type="button"
                onClick={() => setDesktopLoginOpen(false)}
                aria-label="Close login"
              >
                ×
              </button>
            </header>
            <BantrboksAuth initialMode="signin" />
          </section>
        </div>
      ) : null}
    </main>
  );
}
