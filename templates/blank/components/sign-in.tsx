"use client";

// The whole auth layer for this app, in one client island.
//
// Three states, not two. The stored session is restored by an async call, so a
// UI that treats "not signed in yet" as "signed out" flashes the login button
// at people who are already members on every reload.

import type { UserSchema } from "@resultdev/sdk";
import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";

export function SignIn() {
  const [user, setUser] = useState<UserSchema | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // getCurrentUser() is what redeems the stored session. onAuthStateChange()
    // reports changes from here on and never fires for the session that
    // already exists, so this needs both, not either.
    backend.auth
      .getCurrentUser()
      .then(({ data }) => setUser(data.user))
      .finally(() => setLoading(false));

    return backend.auth.onAuthStateChange(() => {
      void backend.auth.getCurrentUser().then(({ data }) => setUser(data.user));
    });
  }, []);

  // Reserve the height so the row does not jump when the session resolves.
  if (loading) return <div className="h-10" />;

  if (user) {
    return (
      <div className="flex h-10 items-center gap-3">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as {user.email}
        </span>
        <button
          className="rounded-full border border-black/10 px-4 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          onClick={() => void backend.auth.signOut()}
          type="button"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      className="flex h-10 w-fit items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
      // From a click handler, never an effect: when this app is framed the SDK
      // opens the provider in a popup, and a popup opened outside a user
      // gesture is blocked by the browser.
      onClick={() =>
        void backend.auth.signInWithOAuth("google", {
          redirectTo: window.location.origin,
        })
      }
      type="button"
    >
      Sign in with Google
    </button>
  );
}
