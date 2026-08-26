/**
 * The one file that knows about the host repo's design system.
 *
 * Every colour and type style the map uses passes through here, under a
 * semantic name. Point these at the repo's own tokens and the map re-themes
 * with the app — including dark mode, because a CSS custom property changes
 * underneath a `var()` without anything re-rendering.
 *
 * Values are CSS colour *expressions*, not hex: `var(--your-token)` is the
 * point. They are used in SVG attributes as well as class names, which is why
 * they are strings here rather than Tailwind classes.
 *
 * Adapted to PagaMiPana: the app has no CSS custom properties (Tailwind
 * utilities only), so the --pmp-* tokens are defined by the page shell that
 * mounts the map, in both themes, from the app's own palette — Inter, blue-600
 * as the accent, and the zinc scale for ink and hairlines. Replacing these
 * is the whole adaptation step — nothing else in the map should ever need
 * to know what design system it is sitting in.
 */

export const paint = {
  /** The page under everything, and the top face of every building. */
  surface: 'var(--pmp-surface, #ffffff)',
  /** Hairlines: the floor grid, cell borders, the quiet edges. */
  border: 'var(--pmp-border, #e4e4e7)',
  /** Building walls and inactive strokes. */
  structure: 'var(--pmp-structure, #a1a1aa)',

  inkPrimary: 'var(--pmp-ink-1, #18181b)',
  inkSecondary: 'var(--pmp-ink-2, #52525b)',
  inkTertiary: 'var(--pmp-ink-3, #a1a1aa)',

  /** Selection, the active flow, the lit neighborhood. */
  accent: 'var(--pmp-accent, #2563eb)',
  /** The accent at wash strength, for filled plates and chips. */
  accentWash: 'var(--pmp-accent-wash, #dbeafe)',
} as const

/**
 * Type. Three roles only: a title, running prose, and the mono label used for
 * codes, paths and chips. Anything a sentence goes in must not be the mono
 * one — monospace is for names, not for reading.
 */
export const type = {
  title: 'var(--pmp-font, Inter, system-ui, sans-serif)',
  body: 'var(--pmp-font, Inter, system-ui, sans-serif)',
  mono: 'var(--pmp-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
} as const

/** The house motion curve, and the two durations the map uses. */
export const motion = {
  ease: 'cubic-bezier(0.32, 0.72, 0, 1)',
  /** Enter and exit. */
  base: 200,
  /** Hover, which should feel immediate. */
  hover: 150,
} as const

/** Joins class names, dropping anything falsy. Replace with the repo's own if it has one. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
