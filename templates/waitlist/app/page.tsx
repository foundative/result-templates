import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist-form";

// Everything a visitor reads is in this file, on purpose. Replacing the copy is
// the first thing anyone does with this template, and hunting it across six
// components is a bad first ten minutes.
const BRAND = "Northbound";
const HEADLINE = "The shipping desk for small teams";
const SUBHEAD =
  "One place for quotes, labels and tracking, without a warehouse system priced for one. Opening to the first hundred teams this spring.";
const EYEBROW = "Opening spring 2026";

const REASONS = [
  {
    title: "Quote in one screen",
    body: "Every carrier you use, priced side by side, before you commit to a box size.",
  },
  {
    title: "Labels that just print",
    body: "No account juggling and no plugin. Paste an address, get a label.",
  },
  {
    title: "Tracking your customers read",
    body: "One page per order, in your own words, instead of a carrier's.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-8">
        <span className="flex items-center gap-2.5 text-sm font-medium">
          <span className="size-2.5 rounded-full bg-accent" />
          {BRAND}
        </span>
        <Link
          className="text-sm text-muted transition-colors hover:text-foreground"
          href="/admin"
        >
          Admin
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-8 py-14">
        <div className="flex flex-col gap-5">
          <span className="w-fit rounded-full border border-line px-3 py-1 text-xs text-muted">
            {EYEBROW}
          </span>
          <h1 className="text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl">
            {HEADLINE}
          </h1>
          <p className="max-w-lg text-base leading-7 text-muted">{SUBHEAD}</p>
        </div>

        <WaitlistForm />
      </section>

      <section className="grid gap-8 border-t border-line py-10 sm:grid-cols-3">
        {REASONS.map((reason, index) => (
          <div className="flex flex-col gap-2" key={reason.title}>
            <span className="font-mono text-xs text-muted">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="text-sm font-medium">{reason.title}</h2>
            <p className="text-sm leading-6 text-muted">{reason.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-line py-8 text-sm text-muted">
        {BRAND}
      </footer>
    </main>
  );
}
