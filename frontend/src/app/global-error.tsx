"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#fffaf0] text-[#12213a]">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-5 px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b38a28]">
            SyncVela recovery
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Something needs another try.</h1>
          <p className="text-base leading-7 text-slate-600">
            The workspace could not be rendered. Your data is safe; retry the request or return to the sign-in page.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-[#12213a] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d3153]"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
