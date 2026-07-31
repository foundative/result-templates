"use client";

// The whole public page: the game, the leaderboard, and the one line that turns
// a toy into a marketing asset (the owner's call to action under it).

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Game } from "@/components/game";
import { backend } from "@/lib/backend";

type Site = {
  user_id: string | null;
  title: string | null;
  tagline: string | null;
  accent: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

type Score = { id: string; name: string; score: number };

const FALLBACK_ACCENT = "#ff4d8d";

export function Arcade() {
  const [site, setSite] = useState<Site | null | undefined>(undefined);
  const [scores, setScores] = useState<Score[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const loadScores = useCallback(async () => {
    const { data } = await backend.database
      .from("scores")
      .select("id,name,score")
      .order("score", { ascending: false })
      .limit(10);
    setScores((data as Score[] | null) ?? []);
  }, []);

  useEffect(() => {
    backend.database
      .from("site")
      .select("user_id,title,tagline,accent,cta_label,cta_url")
      .limit(1)
      .then(({ data }) => setSite((data as Site[] | null)?.[0] ?? null));
    backend.auth
      .getCurrentUser()
      .then(({ data }) => setViewerId(data.user?.id ?? null));
    // The rule below reads this as a synchronous setState in an effect body. It
    // is not: loadScores() awaits the query before it sets anything. The rule
    // cannot see through an async function.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadScores();
  }, [loadScores]);

  const onGameOver = useCallback((score: number) => {
    setLastScore(score);
    setSaved(false);
    // Shows up in Analytics > Web, so the owner can see how many people played
    // and how far they got without building any of it.
    backend.analytics.track("game_over", { score });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lastScore === null) return;
    setProblem(null);
    // Checked, not assumed. Hiding the form on a 429 or a 502 tells the player
    // their score is on the board when it is not, and the only way back is to
    // play another round.
    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, score: lastScore }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setProblem(body?.error ?? "Could not save that score. Try again.");
        return;
      }
    } catch {
      setProblem("Could not reach the server. Check your connection.");
      return;
    }
    setSaved(true);
    await loadScores();
  }

  const accent = normalizeHex(site?.accent) ?? FALLBACK_ACCENT;
  const isOwner = Boolean(viewerId && site && viewerId === site.user_id);

  if (site === undefined) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-muted">
        Loading
      </main>
    );
  }

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 py-10"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <header className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-medium tracking-tight">
          {site?.title?.trim() || "One button. Harder than it looks."}
        </h1>
        {site?.tagline ? (
          <p className="text-sm text-muted">{site.tagline}</p>
        ) : null}
      </header>

      <Game accent={accent} onGameOver={onGameOver} />

      {lastScore !== null && !saved ? (
        <form className="flex gap-2" onSubmit={submit}>
          <input
            // 16px on mobile, or Safari zooms the whole page when it focuses.
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-base outline-none focus:border-accent sm:text-sm"
            maxLength={24}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name for the board"
            value={name}
          />
          <button
            className="h-11 shrink-0 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink"
            type="submit"
          >
            Save {lastScore}
          </button>
        </form>
      ) : null}

      {problem ? (
        <p className="-mt-4 text-center text-sm text-accent">{problem}</p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs tracking-wide text-muted uppercase">
          Top of the board
        </h2>
        {scores.length === 0 ? (
          <p className="rounded-2xl border border-line border-dashed px-5 py-8 text-center text-sm text-muted">
            Nobody has played yet. Be first.
          </p>
        ) : (
          <ol className="flex flex-col gap-1">
            {scores.map((entry, index) => (
              <li
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm odd:bg-surface"
                key={entry.id}
              >
                <span className="w-5 font-mono text-xs text-muted">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                <span className="font-mono">{entry.score}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {site?.cta_url && site?.cta_label ? (
        <a
          className="flex h-12 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-ink"
          href={site.cta_url}
          onClick={() => backend.analytics.track("game_cta_click")}
          rel="noopener noreferrer"
          target="_blank"
        >
          {site.cta_label}
        </a>
      ) : null}

      {!site || isOwner ? (
        <Link
          className="text-center text-sm text-muted underline underline-offset-4"
          href="/admin"
        >
          {site ? "Edit this page" : "Set this page up"}
        </Link>
      ) : null}
    </main>
  );
}

/** `#abc` and `abcdef` both become `#aabbcc`. Anything else becomes null. */
function normalizeHex(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const raw = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw
      .split("")
      .map((c) => c + c)
      .join("")}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toLowerCase()}`;
  return null;
}
