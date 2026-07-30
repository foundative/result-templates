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
  const [problem, setProblem] = useState<string | null>(null);

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

  // Every auth call RETURNS its error rather than throwing, so a handler that
  // ignores the result turns a blocked popup, an unreachable backend or a
  // cross-origin redirectTo into a button that visibly does nothing. Show it.
  async function signIn() {
    setProblem(null);
    const { error } = await backend.auth.signInWithOAuth("google", {
      // Must stay on this app's own origin: the popup can only hand its result
      // back to a page it shares an origin with.
      redirectTo: window.location.origin,
    });
    if (error) setProblem(error.nextActions ?? error.message);
  }

  async function signOut() {
    const { error } = await backend.auth.signOut();
    if (error) setProblem(error.message);
  }

  // Reserve the height so the row does not jump when the session resolves.
  if (loading) return <div className="h-10" />;

  if (user) {
    return (
      <div className="flex h-10 items-center gap-3">
        <span className="text-sm text-zinc-600">Signed in as {user.email}</span>
        <button
          className="rounded-full border border-black/10 px-4 py-1.5 text-sm transition-colors hover:bg-black/5"
          onClick={() => void signOut()}
          type="button"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        className="flex h-10 w-fit items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        // From a click handler, never an effect: when this app is framed the SDK
        // opens the provider in a popup, and a popup opened outside a user
        // gesture is blocked by the browser.
        onClick={() => void signIn()}
        type="button"
      >
        Sign in with Google
      </button>
      {problem ? <p className="text-sm text-red-600">{problem}</p> : null}
    </div>
  );
}
