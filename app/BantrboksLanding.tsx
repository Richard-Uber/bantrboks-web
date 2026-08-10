import { BantrboksAuth } from "./BantrboksAuth";

const appStoreUrl = "https://apps.apple.com/app/bantrbox/id6791587145";
const playStoreUrl = "https://play.google.com/store/apps/details?id=com.bantrbox.app";

const hotspots = [
  { label: "App", href: "#app", className: "hotspot-app" },
  { label: "Privacy", href: "https://bantrbox.com/privacy", className: "hotspot-nav-privacy", external: true },
  { label: "Terms", href: "https://bantrbox.com/terms", className: "hotspot-nav-terms", external: true },
  { label: "Community Guidelines", href: "https://bantrbox.com/community-guidelines", className: "hotspot-nav-community", external: true },
  { label: "Safety Standards", href: "https://bantrbox.com/safety-standards", className: "hotspot-nav-safety", external: true },
  { label: "Support", href: "https://bantrbox.com/support", className: "hotspot-nav-support", external: true },
  { label: "Download on the App Store", href: appStoreUrl, className: "hotspot-app-store", external: true },
  { label: "Get it on Google Play", href: playStoreUrl, className: "hotspot-play-store", external: true },
  { label: "Privacy Policy", href: "https://bantrbox.com/privacy", className: "hotspot-card-privacy", external: true },
  { label: "Terms and Conditions", href: "https://bantrbox.com/terms", className: "hotspot-card-terms", external: true },
  { label: "Community Guidelines", href: "https://bantrbox.com/community-guidelines", className: "hotspot-card-community", external: true },
  { label: "Safety Standards", href: "https://bantrbox.com/safety-standards", className: "hotspot-card-safety", external: true },
  { label: "Email support", href: "mailto:support@ubermobi.com", className: "hotspot-email" },
];

export function BantrboksLanding() {
  return (
    <main className="approved-landing" id="app">
      <section className="approved-artboard" aria-label="Bantrboks landing page">
        <img
          src="/brand/bantrboks-approved-website-landing.png"
          alt="Bantrboks landing page: Drop takes. Win likes. Climb the board."
          draggable={false}
        />
        <h1 className="sr-only">Bantrboks</h1>
        <p className="sr-only">
          Public bantr drops, rankings, live chat and reaction-led feeds built for
          fast-moving debate.
        </p>
        {hotspots.map((hotspot) => (
          <a
            key={`${hotspot.className}-${hotspot.href}`}
            aria-label={hotspot.label}
            className={`approved-hotspot ${hotspot.className}`}
            href={hotspot.href}
            rel={hotspot.external ? "noreferrer" : undefined}
            target={hotspot.external ? "_blank" : undefined}
          />
        ))}
      </section>
      <section className="mobile-landing" aria-label="Bantrboks mobile landing page">
        <header className="mobile-header">
          <img className="mobile-logo" src="/bantrboks-logo.png" alt="Bantrboks" draggable={false} />
        </header>

        <section className="mobile-room-entry" aria-label="Bantrboks room">
          <img
            className="mobile-room-poster"
            src="/brand/bantrboks-room-boks-abs.png"
            alt="BOKS vs ABS Bantrboks room"
            draggable={false}
          />
        </section>

        <BantrboksAuth />

        <section className="mobile-hero">
          <h1>
            Drop your hottest Boks/AB takes.
            <span>Win likes • Support your team</span>
            <strong>Climb the board</strong>
          </h1>
          <div className="mobile-rule" />
          <p className="mobile-copy">
            Public bantr drops, rankings, live chat and reaction-led feeds built
            for fast-moving debate.
          </p>
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
    </main>
  );
}
