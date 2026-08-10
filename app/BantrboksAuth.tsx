"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthMode = "create" | "signin";

const roomName = "Springboks vs All Blacks";
const roomSlug = "springboksvsallblacks";
const legalVersion = "bantrboks-2026-08";

function normaliseHandle(value: string) {
  return value
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
}

export function BantrboksAuth() {
  const [mode, setMode] = useState<AuthMode>("create");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const cleanHandle = useMemo(() => normaliseHandle(handle), [handle]);

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
    const avatar = (profileHandle || profileName || "bb").slice(0, 2).toUpperCase();
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
        bio: "",
        bantr_feed: [roomSlug],
        permission_preferences: {
          product: "bantrboks",
          default_room: roomSlug,
          current_room: roomSlug,
        },
        terms_accepted_at: now,
        privacy_accepted_at: now,
        legal_version: legalVersion,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      setError(`Your email is verified, but the profile was not created: ${profileError.message}`);
      return false;
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
        setMessage("Email verified. Your Bantrboks account is ready.");

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
        setMessage("Email verified. Your Bantrboks account is ready.");
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

    setBusy(true);

    if (mode === "create") {
      const redirectTo =
        typeof window === "undefined" ? undefined : `${window.location.origin}/?verified=1`;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            display_name: displayName.trim(),
            full_name: displayName.trim(),
            handle: cleanHandle,
            username: cleanHandle,
            product: "bantrboks",
            room: roomName,
            default_room: roomSlug,
          },
        },
      });

      setBusy(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session?.user) {
        const synced = await syncProfile(data.session.user);
        if (!synced) {
          return;
        }
      }

      setMessage(
        data.session
          ? "Account created. Your Bantrboks profile is ready."
          : "Account created. Check your inbox to verify your email, then return here to sign in."
      );
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

    setMessage("Signed in. Your Bantrboks profile is ready.");
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setError("");
  }

  return (
    <form className="mobile-login" aria-label="Bantrboks account access" onSubmit={submit}>
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
          <input
            type="text"
            placeholder="Display name"
            aria-label="Display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
          />
          <input
            type="text"
            placeholder="Handle"
            aria-label="Handle"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            autoComplete="nickname"
          />
        </>
      ) : null}

      <input
        type="email"
        placeholder="Email"
        aria-label="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
      />
      <input
        type="password"
        placeholder="Password"
        aria-label="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete={mode === "create" ? "new-password" : "current-password"}
      />

      {error ? <p className="mobile-login-status error">{error}</p> : null}
      {message ? <p className="mobile-login-status">{message}</p> : null}

      <button className="mobile-auth-primary" type="submit" disabled={busy}>
        {busy ? (mode === "create" ? "Creating..." : "Signing in...") : mode === "create" ? "Create Account" : "Sign in"}
      </button>
      <button
        className="mobile-auth-secondary"
        type="button"
        onClick={() => switchMode(mode === "create" ? "signin" : "create")}
        disabled={busy}
      >
        {mode === "create" ? "I already have an account" : "Create a new account"}
      </button>
      <a href="https://bantrbox.com/support" target="_blank" rel="noreferrer">
        Trouble signing in?
      </a>
    </form>
  );
}
