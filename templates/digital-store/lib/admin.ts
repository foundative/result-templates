import { createClient } from "@resultdev/sdk";

// The backend client that bypasses row-level security. Server code only.
//
// Why this file exists at all: a visitor who has not signed in cannot write to
// your database, and that is on purpose. The alternative is a policy that lets
// anyone insert a row, which is a form anyone can point a script at. So the
// public form posts to a route handler, the handler validates what came in,
// and this client is what writes it.
//
// The rule that follows: never import this from a component. `backend` in
// lib/backend.ts is the browser client and is what pages use.

let client: ReturnType<typeof createClient> | null = null;

export function admin() {
  if (typeof window !== "undefined") {
    // A build that reaches this line has bundled the admin key into browser
    // JavaScript. Failing loudly here is the cheap version of that mistake.
    throw new Error("lib/admin.ts is server-only. Import backend instead.");
  }
  // Built on first use rather than at module scope, so importing this file
  // during a build without keys is not an error.
  client ??= createClient({
    baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL!,
    accessToken: process.env.BACKEND_ADMIN_KEY!,
  });
  return client;
}
