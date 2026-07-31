// Turning "Tuesdays, 9am to 5pm" into actual bookable instants.
//
// The whole file exists because of one problem: availability is written in the
// BUSINESS's local time ("I open at nine"), a booking is an absolute moment,
// and the visitor may be anywhere. Storing "9am" and hoping is how a booking
// system quietly moves every appointment by an hour twice a year.
//
// So availability is stored as a weekday plus minutes past midnight, the
// business's IANA time zone is stored next to it, and everything below converts
// between that and a real instant. No dependency: Intl already knows every
// zone and every daylight saving rule.

export type Availability = {
  id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
};

export type Service = {
  id: string;
  name: string;
  minutes: number;
  price_cents: number | null;
  published: boolean;
};

/** How far ahead the public page offers slots. */
export const DAYS_AHEAD = 14;

/**
 * What a zone's clock is offset from UTC at a given instant, in milliseconds.
 *
 * Formatting the instant IN the zone and reading the numbers back is the only
 * way to ask this without shipping a timezone database of our own.
 */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    // Some locales render midnight as hour 24.
    read("hour") % 24,
    read("minute"),
    read("second"),
  );
  return asUtc - at.getTime();
}

/**
 * The instant at which a wall clock in `timeZone` reads this date and minute.
 *
 * Guess that the wall clock is UTC, ask what the zone's offset is around that
 * guess, then subtract it. One correction is right everywhere except inside the
 * hour a daylight saving change skips, which is not a time anyone can be
 * standing in anyway.
 */
export function zonedInstant(
  day: string,
  minutes: number,
  timeZone: string,
): Date {
  const [year, month, date] = day.split("-").map(Number);
  const guess = Date.UTC(
    year ?? 1970,
    (month ?? 1) - 1,
    date ?? 1,
    Math.floor(minutes / 60),
    minutes % 60,
  );
  return new Date(guess - zoneOffsetMs(new Date(guess), timeZone));
}

/** "2026-08-04", as that instant is dated in `timeZone`. */
export function zonedDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** 0 for Sunday through 6 for Saturday, as `timeZone` sees this instant. */
export function zonedWeekday(at: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(at);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/** The next `DAYS_AHEAD` calendar days in the business's zone, from today. */
export function upcomingDays(timeZone: string, from = new Date()): string[] {
  const days: string[] = [];
  for (let index = 0; index < DAYS_AHEAD; index++) {
    days.push(zonedDay(new Date(from.getTime() + index * 86_400_000), timeZone));
  }
  return days;
}

/**
 * Every slot a service could be booked into, free or not.
 *
 * Slots start on the service's own length, so a 30 minute service offers 9:00,
 * 9:30, 10:00, and a 45 minute one offers 9:00, 9:45. A slot that would run
 * past the end of the window is not offered.
 */
export function slotsForDay(
  day: string,
  availability: Availability[],
  service: Service,
  timeZone: string,
): Date[] {
  const at = zonedInstant(day, 12 * 60, timeZone);
  const weekday = zonedWeekday(at, timeZone);
  const windows = availability.filter((window) => window.weekday === weekday);
  const slots: Date[] = [];
  for (const window of windows) {
    for (
      let minute = window.start_minute;
      minute + service.minutes <= window.end_minute;
      minute += service.minutes
    ) {
      slots.push(zonedInstant(day, minute, timeZone));
    }
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

/** Whether two appointments overlap at all. */
export function overlaps(
  aStart: number,
  aMinutes: number,
  bStart: number,
  bMinutes: number,
): boolean {
  return (
    aStart < bStart + bMinutes * 60_000 && bStart < aStart + aMinutes * 60_000
  );
}

/** "9:00 am", in the business's zone rather than the reader's. */
export function formatTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

/** "Tue 4 Aug", in the business's zone. */
export function formatDay(day: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(zonedInstant(day, 12 * 60, timeZone));
}

/** 540 becomes "09:00", which is what an <input type="time"> wants. */
export function minutesToClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "09:00" becomes 540. Anything unreadable becomes null. */
export function clockToMinutes(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "1200" becomes "12.00". Money is an integer of cents everywhere else. */
export function formatPrice(cents: number | null): string | null {
  if (cents === null || cents <= 0) return null;
  return (cents / 100).toFixed(2);
}
