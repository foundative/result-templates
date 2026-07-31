// Shapes and helpers shared by the public page and the editor.

export type Site = {
  id: string;
  user_id: string | null;
  display_name: string | null;
  tagline: string | null;
  bio: string | null;
  avatar_url: string | null;
  accent: string | null;
};

export type LinkRow = {
  id: string;
  label: string;
  url: string;
  position: number;
  published: boolean;
};

/**
 * Black or white, whichever stays readable on `hex`.
 *
 * The owner picks one accent and the button label has to sit on it. Hardcoding
 * white breaks the moment somebody picks yellow, which they will.
 */
export function readableInk(hex: string | null | undefined): string {
  const value = normalizeHex(hex);
  if (!value) return "#ffffff";
  const r = Number.parseInt(value.slice(1, 3), 16);
  const g = Number.parseInt(value.slice(3, 5), 16);
  const b = Number.parseInt(value.slice(5, 7), 16);
  // Perceived brightness, not an average: the eye reads green as much brighter
  // than blue, so an average calls #0000ff light and puts black text on navy.
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "#1c1a17" : "#ffffff";
}

/** `#abc` and `abcdef` both become `#aabbcc`. Anything else becomes null. */
export function normalizeHex(hex: string | null | undefined): string | null {
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

/**
 * A link the browser will actually follow.
 *
 * Someone typing "acme.com" means https. Someone pasting "javascript:..." into
 * their own page is only hurting themselves, but this page is rendered for
 * visitors, so the scheme is checked rather than trusted.
 */
export function safeUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const allowed = ["http:", "https:", "mailto:", "tel:"];
    return allowed.includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * A collision-free object key for an upload.
 *
 * The key is generated HERE rather than read back off the upload response, and
 * that is deliberate. `upload()` returns three different shapes depending on
 * which strategy the backend picks, and only one of them is guaranteed to carry
 * a `url`. Knowing the key up front means the public URL is built from
 * something certain instead of something that is usually there.
 */
export function objectKey(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const hasExt = dot > 0;
  const ext = hasExt ? filename.slice(dot) : "";
  const base = hasExt ? filename.slice(0, dot) : filename;
  const safe = base.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 32) || "file";
  return `${safe}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

/** "Ada Lovelace" becomes "AL". Used when there is no avatar yet. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
