'use client'

export function SiteFooter() {
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center pb-2 text-[10px] text-muted-foreground/60">
      <span className="pointer-events-auto">
        Strata · inkOrange · sibling to{' '}
        <a
          href="https://molecular.chriswest.tech"
          className="underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Molecular
        </a>
      </span>
    </footer>
  )
}
