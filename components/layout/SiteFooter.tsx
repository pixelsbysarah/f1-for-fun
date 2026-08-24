import { dataSourceCredit, links } from "@/lib/config/content";

/** Official GitHub mark (Octicon), inlined as the standard SVG per CLAUDE.md. */
function GitHubMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/**
 * Low-visual-weight footer. Line 1: data-source credit. Line 2: GitHub repo
 * link alongside the portfolio link.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/10">
      <div className="mx-auto max-w-5xl px-6 py-6 text-center text-xs text-off-white/45">
        <p>{dataSourceCredit}</p>
        <p className="mt-2 flex items-center justify-center gap-4">
          <a
            href={links.github}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-off-white"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubMark />
            <span>GitHub</span>
          </a>
          <span aria-hidden="true">·</span>
          <a
            href={links.portfolio}
            className="transition-colors hover:text-off-white"
            target="_blank"
            rel="noopener noreferrer"
          >
            pixelsbysarah.com
          </a>
        </p>
      </div>
    </footer>
  );
}
