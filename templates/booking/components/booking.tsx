"use client";

// The public booking flow, in three steps on one page: pick a service, pick a
// time, leave your details.
//
// Why this is a client component and not a server one: a server component that
// awaits a backend read is PRERENDERED AT BUILD TIME by default, when there is
// no database to read. The page would ship with no services and stay that way.
// If you want this rendered on the server, add
// `export const dynamic = "force-dynamic"` to the page, which does work.

import Link from "next/link";
import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import { type Service, formatDay, formatPrice, formatTime } from "@/lib/schedule";

type Site = {
  business_name: string | null;
  tagline: string | null;
  time_zone: string | null;
};

type Slots = {
  timeZone: string;
  service: { id: string; name: string; minutes: number };
  days: { day: string; slots: string[] }[];
};

export function Booking() {
  const [site, setSite] = useState<Site | null | undefined>(undefined);
  const [services, setServices] = useState<Service[]>([]);
  const [service, setService] = useState<Service | null>(null);
  const [slots, setSlots] = useState<Slots | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    backend.database
      .from("site")
      .select("business_name,tagline,time_zone")
      .limit(1)
      .then(({ data }) => setSite((data as Site[] | null)?.[0] ?? null));
    backend.database
      .from("services")
      .select("id,name,minutes,price_cents,published")
      .eq("published", true)
      .order("created_at", { ascending: true })
      .then(({ data }) => setServices((data as Service[] | null) ?? []));
  }, []);

  async function pick(next: Service) {
    setService(next);
    setChosen(null);
    setSlots(null);
    const response = await fetch(`/api/slots?service=${next.id}`);
    if (response.ok) setSlots((await response.json()) as Slots);
  }

  if (site === undefined) {
    return (
      <Frame>
        <div className="h-7 w-52 animate-pulse rounded-full bg-line" />
        <div className="h-4 w-64 animate-pulse rounded-full bg-line" />
      </Frame>
    );
  }

  if (!site) {
    return (
      <Frame>
        <h1 className="text-xl font-medium">This page is not set up yet</h1>
        <p className="max-w-xs text-sm leading-6 text-muted">
          Open the admin side, claim the page, and add what you offer.
        </p>
        <Link
          className="flex h-11 items-center rounded-xl bg-accent px-6 text-sm font-medium text-accent-ink"
          href="/admin"
        >
          Open the admin
        </Link>
      </Frame>
    );
  }

  const timeZone = slots?.timeZone ?? site.time_zone ?? "UTC";

  if (confirmed) {
    return (
      <Frame>
        <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 16 16" width="18">
            <path
              d="M3 8.5 6.5 12 13 4.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </span>
        <h1 className="text-xl font-medium">You are booked</h1>
        <p className="max-w-sm text-sm leading-6 text-muted">
          {confirmed}. A confirmation is on its way to your inbox.
        </p>
      </Frame>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-5 py-12 sm:py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-medium tracking-tight">
          {site.business_name?.trim() || "Book an appointment"}
        </h1>
        {site.tagline ? (
          <p className="text-base leading-7 text-muted">{site.tagline}</p>
        ) : null}
      </header>

      <Step label="What do you need?" number={1}>
        {services.length === 0 ? (
          <Empty>Nothing is bookable yet.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {services.map((entry) => {
              const price = formatPrice(entry.price_cents);
              const selected = service?.id === entry.id;
              return (
                <button
                  className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                    selected
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-card hover:bg-background"
                  }`}
                  key={entry.id}
                  onClick={() => void pick(entry)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {entry.name}
                    </span>
                    <span className="block text-sm text-muted">
                      {entry.minutes} minutes
                    </span>
                  </span>
                  {price ? (
                    <span className="shrink-0 text-sm">{price}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </Step>

      {service ? (
        <Step label="When suits you?" number={2}>
          {slots === null ? (
            <p className="text-sm text-muted">Finding open times</p>
          ) : slots.days.length === 0 ? (
            <Empty>
              No open times in the next two weeks. Try again in a few days.
            </Empty>
          ) : (
            <div className="flex flex-col gap-5">
              {slots.days.map((entry) => (
                <div className="flex flex-col gap-2" key={entry.day}>
                  <p className="text-xs tracking-wide text-muted uppercase">
                    {formatDay(entry.day, timeZone)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {entry.slots.map((slot) => (
                      <button
                        className={`h-10 rounded-xl border px-3.5 text-sm transition-colors ${
                          chosen === slot
                            ? "border-accent bg-accent text-accent-ink"
                            : "border-line bg-card hover:bg-background"
                        }`}
                        key={slot}
                        onClick={() => setChosen(slot)}
                        type="button"
                      >
                        {formatTime(new Date(slot), timeZone)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted">Times shown in {timeZone}.</p>
            </div>
          )}
        </Step>
      ) : null}

      {service && chosen ? (
        <Step label="Who is it for?" number={3}>
          <Details
            onBooked={(when) => setConfirmed(when)}
            onTaken={() => void pick(service)}
            serviceId={service.id}
            startsAt={chosen}
          />
        </Step>
      ) : null}
    </main>
  );
}

function Details({
  onBooked,
  onTaken,
  serviceId,
  startsAt,
}: {
  readonly onBooked: (when: string) => void;
  readonly onTaken: () => void;
  readonly serviceId: string;
  readonly startsAt: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ service: serviceId, startsAt, name, email, note }),
      });
      const body = (await response.json()) as { error?: string; when?: string };
      setBusy(false);
      if (!response.ok) {
        setProblem(body.error ?? "Could not book that.");
        // Somebody else took the slot between loading the page and pressing the
        // button. Reload the times so the one they cannot have disappears.
        if (response.status === 409) onTaken();
        return;
      }
      backend.analytics.track("booking_made", { service: serviceId });
      onBooked(body.when ?? "You are booked");
    } catch {
      setBusy(false);
      setProblem("Could not reach the server. Check your connection.");
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <Field label="Name" onChange={setName} required value={name} />
      <Field
        label="Email"
        onChange={setEmail}
        required
        type="email"
        value={email}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Anything we should know?</span>
        <textarea
          className="min-h-20 rounded-xl border border-line bg-card px-4 py-3 text-base outline-none transition-colors focus:border-accent sm:text-sm"
          onChange={(event) => setNote(event.target.value)}
          value={note}
        />
      </label>
      {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
      <button
        className="h-11 rounded-xl bg-accent text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
        disabled={busy}
        type="submit"
      >
        {busy ? "Booking" : "Confirm booking"}
      </button>
    </form>
  );
}

function Step({
  children,
  label,
  number,
}: {
  readonly children: React.ReactNode;
  readonly label: string;
  readonly number: number;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2.5 text-sm font-medium">
        <span className="flex size-5 items-center justify-center rounded-full bg-accent-soft font-mono text-xs text-accent">
          {number}
        </span>
        {label}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  onChange,
  required,
  type = "text",
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly type?: string;
  readonly value: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      <input
        // 16px on mobile, or Safari zooms the whole page when the field focuses.
        className="h-11 rounded-xl border border-line bg-card px-4 text-base outline-none transition-colors focus:border-accent sm:text-sm"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function Empty({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-line border-dashed px-5 py-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}

function Frame({ children }: { readonly children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-5 py-20 text-center">
      {children}
    </main>
  );
}
