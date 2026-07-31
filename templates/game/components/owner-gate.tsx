"use client";

// Who is allowed to see the admin side of this app.
//
// The problem this solves: anyone with a Google account can sign in to an app
// on the open internet, so "signed in" is not "the owner". This app needs one
// owner and has no way to be told who that is at build time.
//
// So ownership is claimed, once, and the database enforces it. The `site` table
// holds exactly one row (a check constraint plus a unique index make a second
// one impossible), and its `user_id` defaults to whoever inserted it. The first
// person to sign in and press the button becomes the owner, permanently, and
// every owner-only policy in this app is written against that row.
//
// The honest caveat: if you share the URL before you have claimed it, the first
// visitor to press the button owns your app. Open /admin and claim it now.

import type { UserSchema } from "@resultdev/sdk";
import { useCallback, useEffect, useState } from "react";
import { backend } from "@/lib/backend";

type Owner = { user_id: string | null };

type Status =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "unclaimed"; user: UserSchema }
  | { state: "not-owner"; user: UserSchema }
  | { state: "owner"; user: UserSchema };

export function OwnerGate({
  children,
}: {
  readonly children: (user: UserSchema) => React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [problem, setProblem] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const resolve = useCallback(async () => {
    // getCurrentUser() is what redeems the stored session. Treating "not
    // resolved yet" as "signed out" would flash the sign-in screen at the owner
    // on every reload.
    const { data } = await backend.auth.getCurrentUser();
    const user = data.user;
    if (!user) {
      setStatus({ state: "signed-out" });
      return;
    }
    const { data: rows } = await backend.database
      .from("site")
      .select("user_id")
      .limit(1);
    const owner = (rows as Owner[] | null)?.[0];
    if (!owner) setStatus({ state: "unclaimed", user });
    else if (owner.user_id === user.id) setStatus({ state: "owner", user });
    else setStatus({ state: "not-owner", user });
  }, []);

  useEffect(() => {
    // The rule below reads this as a synchronous setState in an effect body. It
    // is not: resolve() awaits the session before it sets anything, so the
    // first state change lands in a promise callback like any other. The rule
    // cannot see through an async function.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void resolve();
    // onAuthStateChange never fires for the session that already exists, so
    // this needs both, not either.
    return backend.auth.onAuthStateChange(() => void resolve());
  }, [resolve]);

  async function signIn() {
    setProblem(null);
    // From a click handler, never an effect: when this app is framed the SDK
    // opens the provider in a popup, and a popup opened outside a user gesture
    // is blocked by the browser.
    const { error } = await backend.auth.signInWithOAuth("google", {
      redirectTo: window.location.origin,
    });
    // Every auth call RETURNS its error rather than throwing, so ignoring the
    // result turns a blocked popup into a button that visibly does nothing.
    if (error) setProblem(error.nextActions ?? error.message);
  }

  async function claim() {
    setClaiming(true);
    setProblem(null);
    // user_id is filled in from the session by a column default, so it is not
    // sent here and cannot be forged from the client.
    const { error } = await backend.database.from("site").insert({ lock: true });
    setClaiming(false);
    if (error) {
      // 23505 means somebody claimed it between the read and this write.
      setProblem(
        error.code === "23505"
          ? "This app was just claimed by someone else."
          : error.message,
      );
    }
    await resolve();
  }

  if (status.state === "loading") {
    return <Centered>Checking your access</Centered>;
  }

  if (status.state === "signed-out") {
    return (
      <Centered>
        <p className="text-base">Sign in to manage this app.</p>
        <button
          className="h-11 rounded-full bg-accent px-6 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          onClick={() => void signIn()}
          type="button"
        >
          Sign in with Google
        </button>
        {problem ? <p className="text-sm text-accent">{problem}</p> : null}
      </Centered>
    );
  }

  if (status.state === "unclaimed") {
    return (
      <Centered>
        <p className="text-base">This app does not have an owner yet.</p>
        <p className="max-w-sm text-sm leading-6 text-muted">
          Claim it as {status.user.email} and only you will be able to see who
          has signed up. This cannot be undone or transferred from here.
        </p>
        <button
          className="h-11 rounded-full bg-accent px-6 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          disabled={claiming}
          onClick={() => void claim()}
          type="button"
        >
          {claiming ? "Claiming" : "Claim this app"}
        </button>
        {problem ? <p className="text-sm text-accent">{problem}</p> : null}
      </Centered>
    );
  }

  if (status.state === "not-owner") {
    return (
      <Centered>
        <p className="text-base">This app belongs to someone else.</p>
        <p className="max-w-sm text-sm leading-6 text-muted">
          You are signed in as {status.user.email}. Sign in with the account that
          claimed it.
        </p>
        <button
          className="h-11 rounded-full border border-line px-6 text-sm transition-colors hover:bg-surface"
          onClick={() => void backend.auth.signOut()}
          type="button"
        >
          Sign out
        </button>
      </Centered>
    );
  }

  return <>{children(status.user)}</>;
}

function Centered({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center text-muted">
      {children}
    </div>
  );
}
