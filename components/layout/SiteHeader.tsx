/**
 * Top header band. Holds a placeholder for the user-provided logo; real logo
 * asset is wired in a later ticket.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
        {/* Logo placeholder — swap for the real logo asset later. */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-white/25 text-[0.65rem] uppercase tracking-wider text-white/40"
          aria-label="Logo placeholder"
        >
          logo
        </div>
        <span className="font-heading text-sm font-bold tracking-wide text-off-white/80">
          For Fun
        </span>
      </div>
    </header>
  );
}
