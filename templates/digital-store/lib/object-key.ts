/**
 * A collision-free object key for an upload.
 *
 * Generated HERE rather than read back off the upload response. `upload()`
 * returns three different shapes depending on which strategy the backend picks,
 * so storing the wrong field would mean the file uploads fine and every buyer's
 * download 404s afterwards.
 *
 * Its own file, and not part of lib/purchases.ts, because the admin page is a
 * client component: importing it from a module that also imports `admin()`
 * would pull the server-only client into the browser bundle.
 */
export function objectKey(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const hasExt = dot > 0;
  const ext = hasExt ? filename.slice(dot) : "";
  const base = hasExt ? filename.slice(0, dot) : filename;
  const safe = base.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 32) || "file";
  return `${safe}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}
