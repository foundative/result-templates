import Link from "next/link";

// Next ships a built-in 404, and it is the one surface in this app that would
// still follow the viewer's system colors: its styles are inlined by the
// framework and carry their own light block. Owning the page keeps the whole app
// on one palette, and a stock framework error page in someone's product reads
// as unfinished anyway.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-20">
      <h1 className="text-2xl font-medium tracking-tight">Page not found</h1>
      <p className="text-base leading-7 text-muted">
        There is nothing at this address.
      </p>
      <Link className="text-sm underline underline-offset-4" href="/">
        Go back home
      </Link>
    </main>
  );
}
