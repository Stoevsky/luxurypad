/**
 * The LuxuryPad crown, drawn as vector rather than placed as a bitmap.
 *
 * The mark appears at 20-28px in the header and at 16px in a browser tab. A
 * photographic crown — gradient sky, cloud bank, soft-focus bevels — carries
 * almost none of that detail down to 16px; it resolves to a beige smudge. The
 * silhouette is the only part that survives at favicon size, so the silhouette
 * is what this draws.
 *
 * `currentColor` is deliberately not used: the mark is gold in every placement,
 * including on the ink-coloured surfaces, so it must not inherit text colour.
 */
export function Crown({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Lit from the upper left, matching the textures on the same page. */}
        <linearGradient id="lp-crown" x1="6" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e4d3ae" />
          <stop offset="0.45" stopColor="#c9ab74" />
          <stop offset="1" stopColor="#a8884f" />
        </linearGradient>
      </defs>
      {/* Three peaks, centre tallest, with the valleys cut deep enough that the
          shape still reads as a crown when it is only 16 pixels wide. */}
      <path
        d="M6.6 32.2 8.9 11.4a0.7 0.7 0 0 1 1.23-0.38l7.3 9.95a0.7 0.7 0 0 0 1.14-0.04L23.4 5.6a0.7 0.7 0 0 1 1.2 0l4.83 15.33a0.7 0.7 0 0 0 1.14 0.04l7.3-9.95a0.7 0.7 0 0 1 1.23 0.38l2.3 20.8Z"
        fill="url(#lp-crown)"
      />
      <rect x="5.4" y="34.1" width="37.2" height="8.4" rx="1.6" fill="url(#lp-crown)" />
      {/* The rim that separates band from body in the reference artwork. */}
      <rect x="5.4" y="34.1" width="37.2" height="1.5" rx="0.75" fill="#f1e4c6" opacity="0.55" />
    </svg>
  );
}
