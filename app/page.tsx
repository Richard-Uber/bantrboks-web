const appStoreUrl =
  "https://apps.apple.com/app/bantrbox/id6791587145";
const playStoreUrl =
  "https://play.google.com/store/apps/details?id=com.bantrbox.app";

const hotspots = [
  { label: "App", href: "#app", className: "hotspot-app" },
  { label: "Privacy", href: "https://bantrbox.com/privacy", className: "hotspot-nav-privacy", external: true },
  { label: "Terms", href: "https://bantrbox.com/terms", className: "hotspot-nav-terms", external: true },
  {
    label: "Community Guidelines",
    href: "https://bantrbox.com/community-guidelines",
    className: "hotspot-nav-community",
    external: true,
  },
  {
    label: "Safety Standards",
    href: "https://bantrbox.com/safety-standards",
    className: "hotspot-nav-safety",
    external: true,
  },
  { label: "Support", href: "https://bantrbox.com/support", className: "hotspot-nav-support", external: true },
  { label: "Download on the App Store", href: appStoreUrl, className: "hotspot-app-store", external: true },
  { label: "Get it on Google Play", href: playStoreUrl, className: "hotspot-play-store", external: true },
  { label: "Privacy Policy", href: "https://bantrbox.com/privacy", className: "hotspot-card-privacy", external: true },
  { label: "Terms and Conditions", href: "https://bantrbox.com/terms", className: "hotspot-card-terms", external: true },
  {
    label: "Community Guidelines",
    href: "https://bantrbox.com/community-guidelines",
    className: "hotspot-card-community",
    external: true,
  },
  {
    label: "Safety Standards",
    href: "https://bantrbox.com/safety-standards",
    className: "hotspot-card-safety",
    external: true,
  },
  { label: "Email support", href: "mailto:support@ubermobi.com", className: "hotspot-email" },
];

export default function Home() {
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
    </main>
  );
}
