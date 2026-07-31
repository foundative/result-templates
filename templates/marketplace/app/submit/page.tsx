"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { callApi } from "@/lib/api";
import { backend } from "@/lib/backend";

export default function Submit() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    backend.auth
      .getCurrentUser()
      .then(({ data }) => setSignedIn(Boolean(data.user)));
    return backend.auth.onAuthStateChange(() => {
      void backend.auth
        .getCurrentUser()
        .then(({ data }) => setSignedIn(Boolean(data.user)));
    });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    const result = await callApi("/api/listings", {
      method: "POST",
      body: JSON.stringify({
        intent: "submit",
        title,
        url,
        summary,
        category,
        contactEmail,
      }),
    });
    setBusy(false);
    if (result.error) {
      setProblem(result.error);
      return;
    }
    backend.analytics.track("listing_submitted");
    setDone(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-6 py-12">
      <Link className="text-sm text-muted hover:text-foreground" href="/">
        Back to everything
      </Link>

      {done ? (
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-medium tracking-tight">Sent</h1>
          <p className="text-base leading-7 text-muted">
            It goes live once it has been looked at. Nothing else to do.
          </p>
        </div>
      ) : signedIn === null ? (
        <p className="text-sm text-muted">Loading</p>
      ) : !signedIn ? (
        <div className="flex flex-col items-start gap-4">
          <h1 className="text-2xl font-medium tracking-tight">
            Submit a listing
          </h1>
          <p className="text-base leading-7 text-muted">
            Sign in first, so we can reach you if there is a question about it.
          </p>
          <button
            className="h-11 rounded-lg bg-accent px-6 text-sm font-medium text-accent-ink"
            onClick={() =>
              void backend.auth.signInWithOAuth("google", {
                redirectTo: `${window.location.origin}/submit`,
              })
            }
            type="button"
          >
            Sign in with Google
          </button>
        </div>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <h1 className="text-2xl font-medium tracking-tight">
            Submit a listing
          </h1>
          <Field label="Name" onChange={setTitle} required value={title} />
          <Field
            label="Address"
            onChange={setUrl}
            placeholder="acme.com"
            required
            value={url}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">What is it, in a sentence</span>
            <textarea
              className="min-h-24 rounded-lg border border-line bg-surface px-4 py-3 text-base outline-none transition-colors focus:border-accent sm:text-sm"
              onChange={(event) => setSummary(event.target.value)}
              value={summary}
            />
          </label>
          <Field label="Category" onChange={setCategory} value={category} />
          <Field
            label="Email, if we need to ask something"
            onChange={setContactEmail}
            type="email"
            value={contactEmail}
          />
          {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
          <button
            className="h-11 rounded-lg bg-accent text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? "Sending" : "Submit for review"}
          </button>
        </form>
      )}
    </main>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly type?: string;
  readonly value: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      <input
        className="h-11 rounded-lg border border-line bg-surface px-4 text-base outline-none transition-colors focus:border-accent sm:text-sm"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}
