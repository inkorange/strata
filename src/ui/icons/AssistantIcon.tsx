/**
 * AI-assistant "sparkles" mark — the common convention for an AI helper.
 * A large four-point star with a small companion sparkle. Size via className.
 */
export function AssistantIcon({ className }: { className?: string }) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative — the button that
    // wraps this icon carries the accessible label ("Ask the tutor").
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.5l1.7 4.8L18.5 9l-4.8 1.7L12 15.5l-1.7-4.8L5.5 9l4.8-1.7L12 2.5z" />
      <path d="M18.5 13.5l.85 2.4 2.4.85-2.4.85-.85 2.4-.85-2.4-2.4-.85 2.4-.85.85-2.4z" />
    </svg>
  )
}
