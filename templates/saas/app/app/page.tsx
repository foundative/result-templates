import Link from "next/link";
import { Workspace } from "@/components/workspace";

export default function AppPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <h1 className="text-sm font-medium">Your board</h1>
        <div className="flex gap-4 text-sm">
          <Link className="text-muted hover:text-foreground" href="/account">
            Account
          </Link>
          <Link className="text-muted hover:text-foreground" href="/">
            Home
          </Link>
        </div>
      </header>
      <Workspace />
    </main>
  );
}
