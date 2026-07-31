"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OwnerGate } from "@/components/owner-gate";
import { backend } from "@/lib/backend";
import {
  type Availability,
  type Service,
  WEEKDAYS,
  clockToMinutes,
  formatPrice,
  formatTime,
  minutesToClock,
} from "@/lib/schedule";

type Site = {
  id: string;
  business_name: string | null;
  tagline: string | null;
  time_zone: string | null;
  notify_email: string | null;
};

type Booking = {
  id: string;
  service_id: string | null;
  starts_at: string;
  minutes: number;
  name: string;
  email: string;
  note: string | null;
};

export default function Admin() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5">
      <header className="flex items-center justify-between py-8">
        <h1 className="text-sm font-medium">Admin</h1>
        <Link
          className="text-sm text-muted transition-colors hover:text-foreground"
          href="/"
        >
          View the booking page
        </Link>
      </header>
      <OwnerGate>
        {() => (
          <div className="flex flex-1 flex-col gap-10 pb-16">
            <Upcoming />
            <Services />
            <Hours />
            <Settings />
          </div>
        )}
      </OwnerGate>
    </main>
  );
}

function Upcoming() {
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [zone, setZone] = useState("UTC");

  // Declared before the effect that calls it. Function declarations hoist, so
  // this is only for the linter, which reads a later declaration as a value
  // that could change under the effect.
  async function load() {
    // The owner-read policy is what restricts this table. Everything below is
    // just "which ones have not happened yet".
    const { data } = await backend.database
      .from("bookings")
      .select("id,service_id,starts_at,minutes,name,email,note")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(50);
    setRows((data as Booking[] | null) ?? []);
  }

  useEffect(() => {
    backend.database
      .from("site")
      .select("time_zone")
      .limit(1)
      .then(({ data }) => {
        const value = (data as { time_zone: string | null }[] | null)?.[0];
        if (value?.time_zone) setZone(value.time_zone);
      });
    // The rule below reads this as a synchronous setState in an effect body. It
    // is not: load() awaits the query before it sets anything, so the state
    // change lands in a promise callback like any other. The rule cannot see
    // through an async function.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function cancel(id: string) {
    await backend.database.from("bookings").delete().eq("id", id);
    await load();
  }

  if (rows === null) return <p className="text-sm text-muted">Loading</p>;

  return (
    <Section title="Upcoming">
      {rows.length === 0 ? (
        <Empty>Nothing booked yet.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              className="flex items-start justify-between gap-4 rounded-xl border border-line bg-card px-4 py-3"
              key={row.id}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {new Intl.DateTimeFormat(undefined, {
                    timeZone: zone,
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  }).format(new Date(row.starts_at))}
                  {", "}
                  {formatTime(new Date(row.starts_at), zone)}
                </p>
                <p className="truncate text-sm text-muted">
                  {row.name} ({row.email})
                </p>
                {row.note ? (
                  <p className="mt-1 text-sm text-muted">{row.note}</p>
                ) : null}
              </div>
              <button
                className="shrink-0 text-sm text-muted underline underline-offset-4 transition-colors hover:text-foreground"
                onClick={() => void cancel(row.id)}
                type="button"
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Services() {
  const [rows, setRows] = useState<Service[] | null>(null);
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [price, setPrice] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data } = await backend.database
      .from("services")
      .select("id,name,minutes,price_cents,published")
      .order("created_at", { ascending: true });
    setRows((data as Service[] | null) ?? []);
  }

  async function add() {
    setProblem(null);
    const length = Number(minutes);
    if (!name.trim() || !Number.isFinite(length) || length < 5) {
      setProblem("Give it a name and a length of at least 5 minutes.");
      return;
    }
    // Money is stored as whole cents. Keeping it out of floating point is the
    // difference between 12.10 and 12.099999999999999 on a receipt.
    const cents = price.trim() ? Math.round(Number(price) * 100) : null;
    const { error } = await backend.database.from("services").insert({
      name: name.trim(),
      minutes: Math.round(length),
      price_cents: Number.isFinite(cents) ? cents : null,
    });
    if (error) {
      setProblem(error.message);
      return;
    }
    setName("");
    setPrice("");
    await load();
  }

  async function toggle(row: Service) {
    await backend.database
      .from("services")
      .update({ published: !row.published })
      .eq("id", row.id);
    await load();
  }

  async function remove(id: string) {
    await backend.database.from("services").delete().eq("id", id);
    await load();
  }

  if (rows === null) return null;

  return (
    <Section title="What you offer">
      {rows.length === 0 ? (
        <Empty>Nothing yet. Add the first one below.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3"
              key={row.id}
            >
              <div className="min-w-0">
                <p
                  className={`truncate text-sm font-medium ${row.published ? "" : "text-muted line-through"}`}
                >
                  {row.name}
                </p>
                <p className="text-sm text-muted">
                  {row.minutes} minutes
                  {formatPrice(row.price_cents)
                    ? `, ${formatPrice(row.price_cents)}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  className="text-sm text-muted underline underline-offset-4 hover:text-foreground"
                  onClick={() => void toggle(row)}
                  type="button"
                >
                  {row.published ? "Hide" : "Show"}
                </button>
                <button
                  className="text-sm text-muted underline underline-offset-4 hover:text-foreground"
                  onClick={() => void remove(row.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
        <Field label="Name" onChange={setName} value={name} />
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="Minutes" onChange={setMinutes} value={minutes} />
          </div>
          <div className="flex-1">
            <Field
              label="Price (optional)"
              onChange={setPrice}
              value={price}
            />
          </div>
        </div>
        {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
        <Primary onClick={() => void add()}>Add service</Primary>
      </div>
    </Section>
  );
}

function Hours() {
  const [rows, setRows] = useState<Availability[] | null>(null);
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data } = await backend.database
      .from("availability")
      .select("id,weekday,start_minute,end_minute")
      .order("weekday", { ascending: true });
    setRows((data as Availability[] | null) ?? []);
  }

  async function add() {
    setProblem(null);
    const from = clockToMinutes(start);
    const to = clockToMinutes(end);
    if (from === null || to === null || to <= from) {
      setProblem("The end has to be after the start.");
      return;
    }
    const { error } = await backend.database
      .from("availability")
      .insert({ weekday, start_minute: from, end_minute: to });
    if (error) setProblem(error.message);
    else await load();
  }

  async function remove(id: string) {
    await backend.database.from("availability").delete().eq("id", id);
    await load();
  }

  if (rows === null) return null;

  return (
    <Section title="When you are open">
      {rows.length === 0 ? (
        <Empty>
          No hours set, so nothing can be booked. Add a window below.
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3"
              key={row.id}
            >
              <p className="text-sm">
                <span className="font-medium">{WEEKDAYS[row.weekday]}</span>
                <span className="text-muted">
                  {"  "}
                  {minutesToClock(row.start_minute)} to{" "}
                  {minutesToClock(row.end_minute)}
                </span>
              </p>
              <button
                className="text-sm text-muted underline underline-offset-4 hover:text-foreground"
                onClick={() => void remove(row.id)}
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Day</span>
          <select
            className="h-11 rounded-xl border border-line bg-card px-3 text-base outline-none transition-colors focus:border-accent sm:text-sm"
            onChange={(event) => setWeekday(Number(event.target.value))}
            value={weekday}
          >
            {WEEKDAYS.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="From" onChange={setStart} type="time" value={start} />
          </div>
          <div className="flex-1">
            <Field label="To" onChange={setEnd} type="time" value={end} />
          </div>
        </div>
        {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
        <Primary onClick={() => void add()}>Add hours</Primary>
      </div>
    </Section>
  );
}

function Settings() {
  const [site, setSite] = useState<Site | null>(null);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    backend.database
      .from("site")
      .select("id,business_name,tagline,time_zone,notify_email")
      .limit(1)
      .then(({ data }) => {
        const row = (data as Site[] | null)?.[0] ?? null;
        if (row && !row.time_zone) {
          // Seed from the browser rather than leaving it on UTC. An owner who
          // never opens this section still gets their own hours.
          row.time_zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
        setSite(row);
      });
  }, []);

  async function save() {
    if (!site) return;
    setProblem(null);
    const { error } = await backend.database
      .from("site")
      .update({
        business_name: site.business_name,
        tagline: site.tagline,
        time_zone: site.time_zone,
        notify_email: site.notify_email,
      })
      .eq("id", site.id);
    if (error) setProblem(error.message);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (!site) return null;

  return (
    <Section title="Your details">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
        <Field
          label="Business name"
          onChange={(value) => setSite({ ...site, business_name: value })}
          value={site.business_name ?? ""}
        />
        <Field
          label="One line about it"
          onChange={(value) => setSite({ ...site, tagline: value })}
          value={site.tagline ?? ""}
        />
        <Field
          label="Time zone"
          onChange={(value) => setSite({ ...site, time_zone: value })}
          value={site.time_zone ?? ""}
        />
        <Field
          label="Email new bookings to"
          onChange={(value) => setSite({ ...site, notify_email: value })}
          type="email"
          value={site.notify_email ?? ""}
        />
        {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
        <Primary onClick={() => void save()}>
          {saved ? "Saved" : "Save details"}
        </Primary>
      </div>
    </Section>
  );
}

function Section({
  children,
  title,
}: {
  readonly children: React.ReactNode;
  readonly title: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  onChange,
  type = "text",
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
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
        type={type}
        value={value}
      />
    </label>
  );
}

function Primary({
  children,
  onClick,
}: {
  readonly children: React.ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button
      className="h-11 rounded-xl bg-accent text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function Empty({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-line border-dashed px-5 py-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}
