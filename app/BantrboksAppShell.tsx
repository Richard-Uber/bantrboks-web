"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BantrboksApp } from "./BantrboksApp";
import { BantrboksLanding } from "./BantrboksLanding";
import { supabase } from "./supabase";

export function BantrboksAppShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <main className="bb-loading">
        <img src="/bantrboks-logo.png" alt="Bantrboks" />
        <p>Loading Bantrboks...</p>
      </main>
    );
  }

  return session?.user ? <BantrboksApp session={session} /> : <BantrboksLanding />;
}
