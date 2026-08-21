"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { pushBantrboksEventOncePerAccount } from "./bantrboksAnalytics";
import { adultConfirmationPendingKey, adultPolicyVersion } from "./AdultAccountGate";

type AuthMode = "create" | "signin";
type OAuthProvider = "google" | "facebook" | "apple";

const roomName = "Springboks vs All Blacks";
const roomSlug = "springboksvsallblacks";
const legalVersion = "bantrbox-platform-2026-08";
const signupSource = "bantrboks";
const acquisitionCampaign = "springboks-all-blacks-tour";
const oauthReturnPathKey = "bantrboks_oauth_return_path";

function normaliseHandle(value: string) {
  return value
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
}

export function BantrboksAuth({
  initialMode = "create",
  socialFirst = false,
  collapsedManual = false,
}: {
  initialMode?: AuthMode;
  socialFirst?: boolean;
  collapsedManual?: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(!collapsedManual);
  const [adultAccepted, setAdultAccepted] = useState(false);

  const cleanHandle = useMemo(() => normaliseHandle(handle), [handle]);

  function returnToIntendedPage() {
    if (typeof window === "undefined") return false;

    const returnPath = window.sessionStorage.getItem(oauthReturnPathKey);
    if (!returnPath) return false;

    window.sessionStorage.removeItem(oauthReturnPathKey);
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (!returnPath.startsWith("/") || returnPath.startsWith("//") || returnPath === currentPath) {
      return false;
    }

    window.location.assign(returnPath);
    return true;
  }

  async function syncProfile(user?: User | null) {
    const activeUser = user ?? (await supabase.auth.getUser()).data.user;

    if (!activeUser?.id || !activeUser.email) {
      return false;
    }

    const meta = activeUser.user_metadata ?? {};
    const emailHandle = normaliseHandle(activeUser.email.split("@")[0] ?? "");
    const profileHandle = normaliseHandle(
      String(meta.handle || meta.username || cleanHandle || emailHandle)
    );
    const profileName = String(
      meta.display_name || meta.full_name || displayName.trim() || profileHandle
    ).trim();
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id, avatar, bio")
      .eq("id", activeUser.id)
      .maybeSingle();
    const avatar =
      existingProfile?.avatar || (profileHandle || profileName || "bb").slice(0, 2).toUpperCase();
    const now = new Date().toISOString();

    if (!profileHandle || !profileName) {
      return false;
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: activeUser.id,
        email: activeUser.email.trim().toLowerCase(),
        handle: profileHandle,
        display_name: profileName,
        avatar,
        location: "",
        bio: existingProfile?.bio ?? "",
        bantr_feed: [roomSlug],
        permission_preferences: {
          product: "bantrbox",
          signup_source: signupSource,
          acquisition_campaign: acquisitionCampaign,
          created_via: "bantrboks.com",
          default_room: roomSlug,
          current_room: roomSlug,
          legal_scope: "bantrbox-platform",
        },
        terms_accepted_at: now,
        privacy_accepted_at: now,
        legal_version: legalVersion,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      setError(`Your account was created, but the profile was not completed: ${profileError.message}`);
      return false;
    }

    const { error: membershipError } = await supabase.rpc("ensure_personal_account");
    if (membershipError && membershipError.code !== "PGRST202") {
      setError(`Your profile is ready, but master account access was not linked: ${membershipError.message}`);
      return false;
    }

    if (!existingProfile && !profileLookupError) {
      pushBantrboksEventOncePerAccount("sign_up", activeUser.id);
    }

    return true;
  }

  useEffect(() => {
    let isMounted = true;

    async function finishVerifiedSession() {
      const { data } = await supabase.auth.getSession();

      if (!isMounted || !data.session?.user) {
        return;
      }

      const synced = await syncProfile(data.session.user);

      if (isMounted && synced) {
        if (returnToIntendedPage()) return;
        setMessage("Your Bantrbox account is ready in the Bantrboks room.");

        if (window.location.hash || window.location.search.includes("verified")) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }

    finishVerifiedSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted || !session?.user) {
        return;
      }

      const synced = await syncProfile(session.user);
      if (isMounted && synced) {
        if (returnToIntendedPage()) return;
        setMessage("Your Bantrbox account is ready in the Bantrboks room.");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!email.trim() || !password) {
      setError("Add your email and password to continue.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (mode === "create" && (!displayName.trim() || !cleanHandle)) {
      setError("Add a display name and handle to create your account.");
      return;
    }

    if (mode === "create" && !adultAccepted) {
      setError("Confirm that you are 18 or older to create an account.");
      return;
    }

    setBusy(true);

    if (mode === "create") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            full_name: displayName.trim(),
            handle: cleanHandle,
            username: cleanHandle,
            product: "bantrbox",
            signup_source: signupSource,
            acquisition_campaign: acquisitionCampaign,
            created_via: "bantrboks.com",
            room: roomName,
            default_room: roomSlug,
            initial_room_slug: roomSlug,
            legal_scope: "bantrbox-platform",
          },
        },
      });

      if (signUpError) {
        setBusy(false);
        setError(signUpError.message);
        return;
      }

      let activeUser = data.session?.user ?? null;

      if (!activeUser) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (signInError) {
          setBusy(false);
          setError(
            "Account created, but Supabase is still waiting for email verification. Turn off email confirmation for the Bantrboks launch flow, then sign in again."
          );
          return;
        }

        activeUser = signInData.user;
      }

      setBusy(false);

      if (activeUser) {
        const { error: adultError } = await supabase.rpc("confirm_adult_status", {
          p_policy_version: adultPolicyVersion,
          p_source: "bantrboks-web-email",
        });
        if (adultError) {
          setError(`Your account was created, but the 18+ confirmation was not saved: ${adultError.message}`);
          return;
        }
        const synced = await syncProfile(activeUser);
        if (!synced) {
          return;
        }
      }

      setMessage("Bantrbox account created. You have joined the Bantrboks room.");
      return;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    const synced = await syncProfile(data.user);
    if (!synced) {
      return;
    }

    setMessage("Signed in to Bantrbox. Welcome back to the Bantrboks room.");
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setError("");
  }

  async function sendPasswordReset() {
    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("Add your email first, then tap Trouble signing in.");
      return;
    }

    setBusy(true);
    const redirectTo = typeof window === "undefined" ? undefined : window.location.origin;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo }
    );
    setBusy(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage("Password reset email sent. Check your inbox.");
  }

  async function continueWithOAuth(provider: OAuthProvider) {
    setMessage("");
    setError("");
    if (!adultAccepted) {
      setError("Confirm that you are 18 or older before continuing with a social account.");
      return;
    }

    setBusy(true);

    const redirectTo = typeof window === "undefined" ? undefined : window.location.origin;

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        oauthReturnPathKey,
        `${window.location.pathname}${window.location.search}${window.location.hash}`
      );
      window.sessionStorage.setItem(
        adultConfirmationPendingKey,
        `bantrboks-web-${provider}`
      );
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        ...(provider === "google"
          ? { queryParams: { prompt: "select_account" } }
          : provider === "facebook"
            ? { scopes: "email" }
            : { scopes: "name email" }),
      },
    });

    if (oauthError) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(oauthReturnPathKey);
        window.sessionStorage.removeItem(adultConfirmationPendingKey);
      }
      setBusy(false);
      setError(oauthError.message);
    }
  }

  const socialAccess = (
    <>
      <div className="mobile-auth-divider" aria-hidden="true">
        <span>{socialFirst ? "Quick sign in" : "or"}</span>
      </div>
      <div className="mobile-auth-providers" aria-label="Social account access">
        <button
          className="mobile-auth-provider mobile-auth-google"
          type="button"
          onClick={() => continueWithOAuth("google")}
          disabled={busy}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285f4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
            <path fill="#34a853" d="M12 22c2.7 0 4.98-.9 6.63-2.37l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
            <path fill="#fbbc05" d="M6.39 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.31-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.54l3.35-2.62Z" />
            <path fill="#ea4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z" />
          </svg>
          Continue with Google
        </button>
        <button
          className="mobile-auth-provider mobile-auth-apple"
          type="button"
          onClick={() => continueWithOAuth("apple")}
          disabled={busy}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M17.05 12.54c-.03-3.04 2.48-4.51 2.6-4.58a5.57 5.57 0 0 0-4.38-2.37c-1.84-.2-3.63 1.1-4.57 1.1-.96 0-2.4-1.08-3.97-1.05a5.8 5.8 0 0 0-4.88 2.98c-2.12 3.67-.54 9.06 1.49 12.03 1.02 1.45 2.2 3.07 3.77 3.01 1.54-.06 2.11-.97 3.97-.97 1.84 0 2.38.97 3.98.93 1.65-.02 2.69-1.46 3.67-2.92a12.03 12.03 0 0 0 1.68-3.42 5.24 5.24 0 0 1-3.36-4.74ZM14.07 3.64A5.3 5.3 0 0 0 15.28 0a5.4 5.4 0 0 0-3.49 1.73 5.05 5.05 0 0 0-1.24 3.5 4.45 4.45 0 0 0 3.52-1.59Z" />
          </svg>
          Continue with Apple
        </button>
        <button
          className="mobile-auth-provider mobile-auth-facebook"
          type="button"
          onClick={() => continueWithOAuth("facebook")}
          disabled={busy}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M14.1 22v-9h3l.45-3.5H14.1V7.27c0-1.01.28-1.7 1.73-1.7h1.85V2.45c-.32-.04-1.42-.14-2.7-.14-2.67 0-4.5 1.63-4.5 4.63V9.5H7.46V13h3.02v9h3.62Z" />
          </svg>
          Continue with Facebook
        </button>
      </div>
    </>
  );

  const adultConsent = (
    <label className="mobile-auth-adult-check">
      <input
        type="checkbox"
        checked={adultAccepted}
        onChange={(event) => setAdultAccepted(event.target.checked)}
      />
      <span>
        I confirm that I am 18 years of age or older and agree to the{" "}
        <a href="https://bantrbox.com/terms" target="_blank" rel="noreferrer">Terms</a>
        {" "}and{" "}
        <a href="https://bantrbox.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
      </span>
    </label>
  );

  return (
    <form className="mobile-login" aria-label="Bantrbox account access through Bantrboks" onSubmit={submit}>
      {socialFirst ? adultConsent : null}
      {socialFirst ? socialAccess : null}
      {error ? <p className="mobile-login-status error">{error}</p> : null}
      {message ? <p className="mobile-login-status">{message}</p> : null}

      {collapsedManual && !manualOpen ? (
        <button
          className="mobile-auth-secondary mobile-auth-email-toggle"
          type="button"
          onClick={() => setManualOpen(true)}
          disabled={busy}
        >
          Continue with email
        </button>
      ) : (
        <>
          <div className="mobile-auth-tabs" aria-label="Account mode">
            <button
              className={mode === "create" ? "is-active" : undefined}
              type="button"
              onClick={() => switchMode("create")}
              disabled={busy}
            >
              Create
            </button>
            <button
              className={mode === "signin" ? "is-active" : undefined}
              type="button"
              onClick={() => switchMode("signin")}
              disabled={busy}
            >
              Sign in
            </button>
          </div>

          {mode === "create" ? (
            <>
              <p className="mobile-auth-context">
                Create your permanent Bantrbox account and join the Bantrboks Springboks vs All Blacks room.
              </p>
              <input type="text" placeholder="Display name" aria-label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" />
              <input type="text" placeholder="Handle" aria-label="Handle" value={handle} onChange={(event) => setHandle(event.target.value)} autoComplete="nickname" />
              {!socialFirst ? adultConsent : null}
            </>
          ) : null}

          <input type="email" placeholder="Email" aria-label="Email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          <input type="password" placeholder="Password" aria-label="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "create" ? "new-password" : "current-password"} />

          <button className="mobile-auth-primary" type="submit" disabled={busy}>
            {busy ? (mode === "create" ? "Creating..." : "Signing in...") : mode === "create" ? "Create Bantrbox Account" : "Sign in"}
          </button>
          {!socialFirst && mode === "signin" ? adultConsent : null}
          {!socialFirst ? socialAccess : null}
          <button className="mobile-auth-secondary" type="button" onClick={() => switchMode(mode === "create" ? "signin" : "create")} disabled={busy}>
            {mode === "create" ? "I already have an account" : "Create a new account"}
          </button>
          <button className="mobile-auth-link" type="button" onClick={sendPasswordReset} disabled={busy}>
            Trouble signing in?
          </button>
        </>
      )}
    </form>
  );
}
