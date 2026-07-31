import { admin } from "@/lib/admin";
import {
  type Availability,
  type Service,
  formatTime,
  overlaps,
  slotsForDay,
  zonedDay,
} from "@/lib/schedule";

// Taking a booking.
//
// The important line in here is the recheck. Two people can open the page at
// the same time, see the same free slot, and press the button within a second
// of each other. Trusting what the browser sent means the second one silently
// double-books. So the slot is proved free again, here, immediately before the
// insert.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
/** Above this, the oldest addresses are dropped. Keeps the map from being its own leak. */
const RATE_MAX_KEYS = 5000;
const recent = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  hits.push(now);
  // Delete before set so the key moves to the end: Map iterates in insertion
  // order, which makes the eviction below drop the least recently seen.
  recent.delete(ip);
  recent.set(ip, hits);
  if (recent.size > RATE_MAX_KEYS) {
    for (const key of recent.keys()) {
      recent.delete(key);
      if (recent.size <= RATE_MAX_KEYS) break;
    }
  }
  return hits.length > RATE_LIMIT;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return Response.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    service?: unknown;
    startsAt?: unknown;
    name?: unknown;
    email?: unknown;
    note?: unknown;
  } | null;

  const serviceId = typeof body?.service === "string" ? body.service : "";
  const startsAt = typeof body?.startsAt === "string" ? body.startsAt : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;

  if (!name) {
    return Response.json({ error: "Add a name." }, { status: 400 });
  }
  if (!EMAIL.test(email)) {
    return Response.json(
      { error: "That does not look like an email address." },
      { status: 400 },
    );
  }
  const at = Date.parse(startsAt);
  if (!Number.isFinite(at)) {
    return Response.json({ error: "Pick a time." }, { status: 400 });
  }
  if (at < Date.now()) {
    return Response.json(
      { error: "That time has already passed." },
      { status: 409 },
    );
  }

  const db = admin().database;
  const [siteResult, serviceResult, availabilityResult] = await Promise.all([
    db.from("site").select("business_name,time_zone,notify_email").limit(1),
    db
      .from("services")
      .select("id,name,minutes,price_cents,published")
      .eq("id", serviceId)
      .limit(1),
    db.from("availability").select("id,weekday,start_minute,end_minute"),
  ]);

  const site = (siteResult.data as
    | { business_name: string | null; time_zone: string | null; notify_email: string | null }[]
    | null)?.[0];
  const timeZone = site?.time_zone || "UTC";
  const service = (serviceResult.data as Service[] | null)?.[0];
  if (!service || !service.published) {
    return Response.json({ error: "That service is not bookable." }, {
      status: 404,
    });
  }

  // 1. The time has to be one this business actually offers. Without this, a
  //    handcrafted request books 3am on a Sunday.
  const availability = (availabilityResult.data as Availability[] | null) ?? [];
  const day = zonedDay(new Date(at), timeZone);
  const offered = slotsForDay(day, availability, service, timeZone).some(
    (slot) => slot.getTime() === at,
  );
  if (!offered) {
    return Response.json(
      { error: "That time is not open. Pick another." },
      { status: 409 },
    );
  }

  // 2. And it has to still be free. This is the recheck.
  const windowStart = new Date(at - 12 * 3_600_000).toISOString();
  const windowEnd = new Date(at + 12 * 3_600_000).toISOString();
  const { data: nearby } = await db
    .from("bookings")
    .select("starts_at,minutes")
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd);
  const clash = ((nearby as { starts_at: string; minutes: number }[] | null) ?? []).some(
    (row) => overlaps(at, service.minutes, Date.parse(row.starts_at), row.minutes),
  );
  if (clash) {
    return Response.json(
      { error: "Somebody just took that time. Pick another." },
      { status: 409 },
    );
  }

  const { error } = await db.from("bookings").insert({
    service_id: service.id,
    starts_at: new Date(at).toISOString(),
    minutes: service.minutes,
    name,
    email,
    note,
  });
  if (error) {
    return Response.json(
      { error: "Could not save that. Try again in a moment." },
      { status: 502 },
    );
  }

  const when = `${new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(at))} at ${formatTime(new Date(at), timeZone)}`;

  await notify({
    businessName: site?.business_name ?? "your appointment",
    email,
    name,
    note,
    notifyEmail: site?.notify_email ?? null,
    serviceName: service.name,
    when,
  });

  return Response.json({ ok: true, when });
}

/**
 * Best effort, both ways.
 *
 * The booking is already saved by the time this runs. Failing the request
 * because a confirmation bounced would tell someone their appointment did not
 * happen when it did, and they would turn up anyway.
 */
async function notify(details: {
  businessName: string;
  email: string;
  name: string;
  note: string | null;
  notifyEmail: string | null;
  serviceName: string;
  when: string;
}): Promise<void> {
  const style = "font-family:system-ui,sans-serif;font-size:15px;line-height:1.6";
  try {
    await admin().emails.send({
      to: details.email,
      subject: `Booked: ${details.serviceName}, ${details.when}`,
      html: `<div style="${style}">
        <p>Hi ${escapeHtml(details.name)}, your booking is confirmed.</p>
        <p><strong>${escapeHtml(details.serviceName)}</strong><br>${escapeHtml(details.when)}</p>
        <p>Reply to this email if you need to change it.</p>
      </div>`,
    });
  } catch {
    // Nothing the visitor can act on.
  }
  if (!details.notifyEmail) return;
  try {
    await admin().emails.send({
      to: details.notifyEmail,
      subject: `New booking: ${details.serviceName}, ${details.when}`,
      html: `<div style="${style}">
        <p><strong>${escapeHtml(details.name)}</strong> booked ${escapeHtml(details.serviceName)}.</p>
        <p>${escapeHtml(details.when)}<br>${escapeHtml(details.email)}</p>
        ${details.note ? `<p>${escapeHtml(details.note)}</p>` : ""}
      </div>`,
    });
  } catch {
    // Same.
  }
}

/** Visitor-supplied text goes into an email body, so it is escaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
