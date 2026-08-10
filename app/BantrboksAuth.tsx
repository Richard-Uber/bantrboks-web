"use client";

import { FormEvent, useMemo, useState } from "react";
import { supabase } from "./supabase";

type AuthMode = "create" | "signin";

const roomName = "Springboks vs All Blacks";
const roomSlug = "springboksvsallblacks";

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
        typeof window === "undefined" ? undefined : `${window.location.origin}/`;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
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

      setMessage(
        data.session
          ? "Account created. You are signed in to Bantrboks."
          : "Account created. Check your inbox to verify your email, then return here to sign in."
      );
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMessage("Signed in. Welcome to Bantrboks.");
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
