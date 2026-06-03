/**
 * Strata wordmark icon — three horizontal layers in the three module
 * accent colors, evoking the "layers of the Earth" theme. Square 16-unit
 * viewbox; size via the `className` prop.
 */
export function LogoMark({ className, ariaLabel }: { className?: string; ariaLabel?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <rect x="2.5" y="3" width="11" height="1.8" rx="0.9" fill="#ff8c5a" />
      <rect x="2.5" y="7" width="11" height="1.8" rx="0.9" fill="#5cc6ff" />
      <rect x="2.5" y="11" width="11" height="1.8" rx="0.9" fill="#7ad9aa" />
    </svg>
  )
}
