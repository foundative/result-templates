import { SignIn } from "@/components/sign-in";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-10 px-6 py-20">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-medium tracking-tight">
          Your app is ready
        </h1>
        <p className="text-base leading-7 text-zinc-600">
          The database, sign-in and file storage behind this page are already
          running. There is nothing to configure and no keys to paste.
        </p>
      </div>

      <SignIn />

      <div className="flex flex-col gap-2 border-t border-black/10 pt-6 text-sm leading-6 text-zinc-500">
        <p>
          Edit <Code>app/page.tsx</Code> to replace this page.
        </p>
        <p>
          <Code>RESULT.md</Code> documents everything the backend can do, and{" "}
          <Code>lib/backend.ts</Code> is the client to import from.
        </p>
      </div>
    </main>
  );
}

function Code({ children }: { readonly children: React.ReactNode }) {
  return <code className="font-mono text-zinc-900">{children}</code>;
}
