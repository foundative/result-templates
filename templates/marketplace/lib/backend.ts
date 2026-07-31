import { createClient } from "@resultdev/sdk";

// The one backend client for this app. Web analytics and customer support are
// part of the platform (SDK only, no script tags), so they are configured here
// rather than bolted on later. Read RESULT.md for what else is available.
//
// This file is regenerated for you on every build turn, with your workspace's
// analytics and support ids filled in. Import from it, do not rewrite it.
export const backend = createClient({
  baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL!,
  anonKey: process.env.NEXT_PUBLIC_BACKEND_ANON_KEY!,
});
