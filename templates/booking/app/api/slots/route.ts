import { admin } from "@/lib/admin";
import {
  type Availability,
  type Service,
  overlaps,
  slotsForDay,
  upcomingDays,
} from "@/lib/schedule";

// Which times are still free.
//
// This is a route handler rather than a query from the page because the answer
// depends on the `bookings` table, and bookings hold other customers' names and
// email addresses. Row-level security is per row, not per column, so there is no
// policy that would let a visitor read "which slots are taken" without also
// letting them read who took them. So the page never sees bookings at all: it
// asks this, and gets back times.

export async function GET(request: Request) {
  const serviceId = new URL(request.url).searchParams.get("service");
  if (!serviceId) {
    return Response.json({ error: "Pick a service first." }, { status: 400 });
  }

  const db = admin().database;

  const [siteResult, serviceResult, availabilityResult] = await Promise.all([
    db.from("site").select("time_zone").limit(1),
    db
      .from("services")
      .select("id,name,minutes,price_cents,published")
      .eq("id", serviceId)
      .limit(1),
    db.from("availability").select("id,weekday,start_minute,end_minute"),
  ]);

  const timeZone =
    (siteResult.data as { time_zone: string | null }[] | null)?.[0]
      ?.time_zone || "UTC";
  const service = (serviceResult.data as Service[] | null)?.[0];
  if (!service || !service.published) {
    return Response.json({ error: "That service is not bookable." }, {
      status: 404,
    });
  }
  const availability =
    (availabilityResult.data as Availability[] | null) ?? [];

  const days = upcomingDays(timeZone);
  const from = days[0];
  const to = days[days.length - 1];
  // One read for the whole window rather than one per day. Only the two columns
  // needed to decide "taken", so a leak here would leak nothing.
  const { data: bookedRows } = await db
    .from("bookings")
    .select("starts_at,minutes")
    .gte("starts_at", `${from}T00:00:00Z`)
    // The window is in the business's zone and this bound is in UTC, so it is
    // widened by a day rather than being clever about it. Extra rows are
    // harmless; a missing one would double-book somebody.
    .lte("starts_at", `${to}T23:59:59Z`);

  const booked = ((bookedRows as { starts_at: string; minutes: number }[] | null) ??
    []).map((row) => ({
    at: Date.parse(row.starts_at),
    minutes: row.minutes,
  }));

  const now = Date.now();
  const result = days.map((day) => ({
    day,
    slots: slotsForDay(day, availability, service, timeZone)
      .filter((slot) => slot.getTime() > now)
      .filter(
        (slot) =>
          !booked.some((taken) =>
            overlaps(slot.getTime(), service.minutes, taken.at, taken.minutes),
          ),
      )
      .map((slot) => slot.toISOString()),
  }));

  return Response.json({
    timeZone,
    service: { id: service.id, name: service.name, minutes: service.minutes },
    days: result.filter((entry) => entry.slots.length > 0),
  });
}
