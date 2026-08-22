"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export const adultPolicyVersion = "bantrbox-18plus-2026-08";
export const adultConfirmationPendingKey = "bantrbox_adult_confirmation_pending";
export const oauthReturnPathKey = "bantrboks_oauth_return_path";

function readStoredValue(key: string) {
  return window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
}

function clearStoredValue(key: string) {
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}

function returnToSavedPage() {
  const returnPath = readStoredValue(oauthReturnPathKey);
  if (!returnPath) return false;

  clearStoredValue(oauthReturnPathKey);
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (!returnPath.startsWith("/") || returnPath.startsWith("//") || returnPath === currentPath) {
    return false;
  }

  window.location.replace(returnPath);
  return true;
}

export function AdultAccountGate({
  children,
  source,
}: {
  children: ReactNode;
  source: string;
}) {
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const recordConfirmation = useCallback(async (confirmationSource: string) => {
    setBusy(true);
    setError("");
    const { error: confirmationError } = await supabase.rpc("confirm_adult_status", {
      p_policy_version: adultPolicyVersion,
      p_source: confirmationSource,
    });
    setBusy(false);

    if (confirmationError) {
      setError(confirmationError.message);
      setConfirmed(false);
      return false;
    }

    clearStoredValue(adultConfirmationPendingKey);
    setConfirmed(true);
    returnToSavedPage();
    return true;
  }, []);

  useEffect(() => {
    let active = true;

    async function checkStatus() {
      const { data, error: statusError } = await supabase.rpc("has_confirmed_adult_status");
      if (!active) return;

      if (statusError) {
        setError(statusError.message);
        setConfirmed(false);
        return;
      }

      if (data === true) {
        setConfirmed(true);
        returnToSavedPage();
        return;
      }

      const pendingSource = readStoredValue(adultConfirmationPendingKey);
      if (pendingSource) {
        await recordConfirmation(pendingSource);
        return;
      }

      setConfirmed(false);
    }

    void checkStatus();
    return () => {
      active = false;
    };
  }, [recordConfirmation]);

  if (confirmed === true) return <>{children}</>;

  // Keep OAuth callbacks visually neutral while the already-accepted 18+
  // confirmation is recorded and the original campaign URL is restored.
  if (confirmed === null) return null;

  return (
    <main className="adult-gate">
      <section className="adult-gate-card" aria-labelledby="adult-gate-title">
        <img src="/bantrboks-logo.webp" alt="Bantrboks" />
        <span className="adult-gate-kicker">ADULT COMMUNITY</span>
        <h1 id="adult-gate-title">Bantrbox is for adults</h1>
        <p>You must be 18 or older to create, react, reply or manage profiles.</p>

        <label className="adult-gate-check">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>
                I confirm that I am 18 years of age or older and agree to the{" "}
                <a href="https://bantrbox.com/terms" target="_blank" rel="noreferrer">Terms</a>
                {" "}and{" "}
                <a href="https://bantrbox.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
              </span>
        </label>
        <button
          className="adult-gate-continue"
          type="button"
          disabled={!accepted || busy}
          onClick={() => void recordConfirmation(source)}
        >
          {busy ? "Saving…" : "Confirm and continue"}
        </button>
        <button className="adult-gate-signout" type="button" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
        {error ? <p className="adult-gate-error" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
