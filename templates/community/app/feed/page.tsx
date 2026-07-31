import Link from "next/link";
import { Feed } from "@/components/feed";

export default function FeedPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5">
      <header className="flex items-center justify-between py-8">
        <h1 className="text-sm font-medium">The feed</h1>
        <Link
          className="text-sm text-muted transition-colors hover:text-foreground"
          href="/"
        >
          Membership
        </Link>
      </header>
      <Feed />
    </main>
  );
}
