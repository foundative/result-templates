"use client";

// The members-only feed.
//
// Nothing here reads the database. Every post and comment comes from
// /api/feed, which verifies the caller's subscription before it answers. That
// is deliberate: a component that hides content is a component anyone can open
// devtools and un-hide.

import Link from "next/link";
import { useEffect, useState } from "react";
import { callApi } from "@/lib/api";
import { backend } from "@/lib/backend";

type Comment = {
  id: string;
  body: string;
  author_name: string | null;
  created_at: string;
};

type Post = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  author_id: string;
  author_name: string | null;
  created_at: string;
  comments: Comment[];
};

type FeedData = { posts: Post[]; isOwner: boolean; you: string };

/** How often an open tab picks up posts written by other people. */
const POLL_MS = 15_000;

export function Feed() {
  const [feed, setFeed] = useState<FeedData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "out" | "locked">(
    "loading",
  );

  async function load() {
    const result = await callApi<FeedData>("/api/feed");
    if (result.signedOut) {
      setState("out");
      return;
    }
    if (result.needsMembership) {
      setState("locked");
      return;
    }
    if (result.data) {
      setFeed(result.data);
      setState("ready");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // Polling rather than a live socket. On a feed this size the difference is
    // invisible, and it costs no connection to keep alive. Paused while the tab
    // is hidden so a forgotten tab is not asking all night.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  if (state === "loading") {
    return <Centered>Loading</Centered>;
  }

  if (state === "out") {
    return (
      <Centered>
        <p className="text-base text-foreground">Sign in to see the feed.</p>
        <button
          className="h-11 rounded-full bg-accent px-6 text-sm font-medium text-accent-ink"
          onClick={() =>
            void backend.auth.signInWithOAuth("google", {
              redirectTo: `${window.location.origin}/feed`,
            })
          }
          type="button"
        >
          Sign in with Google
        </button>
      </Centered>
    );
  }

  if (state === "locked") {
    return (
      <Centered>
        <p className="text-base text-foreground">This is for members.</p>
        <p className="max-w-sm text-sm leading-6">
          Your membership is not active. Join, or renew, and this opens
          immediately.
        </p>
        <Link
          className="flex h-11 items-center rounded-full bg-accent px-6 text-sm font-medium text-accent-ink"
          href="/"
        >
          See the membership
        </Link>
      </Centered>
    );
  }

  if (!feed) return null;

  return (
    <div className="flex flex-1 flex-col gap-8 pb-16">
      <Composer onDone={load} />
      {feed.posts.length === 0 ? (
        <p className="rounded-3xl border border-line border-dashed px-6 py-14 text-center text-sm text-muted">
          Nothing here yet. Write the first post.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {feed.posts.map((post) => (
            <PostCard
              isOwner={feed.isOwner}
              key={post.id}
              onDone={load}
              post={post}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Composer({ onDone }: { readonly onDone: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    const result = await callApi("/api/feed", {
      method: "POST",
      body: JSON.stringify({ intent: "post", title, body }),
    });
    setBusy(false);
    if (result.error) {
      setProblem(result.error);
      return;
    }
    setTitle("");
    setBody("");
    backend.analytics.track("post_written");
    await onDone();
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5"
      onSubmit={submit}
    >
      <input
        // 16px on mobile, or Safari zooms the whole page when the field focuses.
        className="bg-transparent text-base font-medium outline-none placeholder:text-muted"
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Say something"
        value={title}
      />
      {title ? (
        <>
          <textarea
            className="min-h-24 bg-transparent text-base outline-none placeholder:text-muted sm:text-sm"
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add a bit more"
            value={body}
          />
          {problem ? <p className="text-sm text-accent">{problem}</p> : null}
          <button
            className="h-10 w-fit rounded-full bg-accent px-5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? "Posting" : "Post"}
          </button>
        </>
      ) : null}
    </form>
  );
}

function PostCard({
  isOwner,
  onDone,
  post,
}: {
  readonly isOwner: boolean;
  readonly onDone: () => Promise<void>;
  readonly post: Post;
}) {
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);

  async function send(intent: string, extra: Record<string, unknown> = {}) {
    await callApi("/api/feed", {
      method: "POST",
      body: JSON.stringify({ intent, postId: post.id, ...extra }),
    });
    await onDone();
  }

  return (
    <li className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-medium">{post.title}</h2>
          <p className="text-xs text-muted">
            {post.author_name ?? "Member"}
            {post.pinned ? " · Pinned" : ""}
          </p>
        </div>
        {isOwner ? (
          <div className="flex shrink-0 gap-3 text-xs text-muted">
            <button
              className="underline underline-offset-4 hover:text-foreground"
              onClick={() => void send("pin", { pinned: !post.pinned })}
              type="button"
            >
              {post.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              className="underline underline-offset-4 hover:text-foreground"
              onClick={() => void send("delete")}
              type="button"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {post.body ? (
        <p className="text-sm leading-7 whitespace-pre-line">{post.body}</p>
      ) : null}

      {post.comments.length > 0 ? (
        <ul className="flex flex-col gap-3 border-t border-line pt-4">
          {post.comments.map((entry) => (
            <li className="text-sm leading-6" key={entry.id}>
              <span className="text-muted">
                {entry.author_name ?? "Member"}:{" "}
              </span>
              {entry.body}
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!comment.trim()) return;
            const body = comment;
            setComment("");
            setOpen(false);
            await send("comment", { body });
          }}
        >
          <input
            className="h-10 min-w-0 flex-1 rounded-full border border-line bg-background px-4 text-base outline-none sm:text-sm"
            onChange={(event) => setComment(event.target.value)}
            placeholder="Reply"
            value={comment}
          />
          <button
            className="h-10 shrink-0 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink"
            type="submit"
          >
            Send
          </button>
        </form>
      ) : (
        <button
          className="w-fit text-xs text-muted underline underline-offset-4 hover:text-foreground"
          onClick={() => setOpen(true)}
          type="button"
        >
          Reply
        </button>
      )}
    </li>
  );
}

function Centered({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-20 text-center text-muted">
      {children}
    </div>
  );
}
