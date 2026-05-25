import { notFound } from 'next/navigation'
import { ModuleFrame } from '@/src/shell/ModuleFrame'
import { MODULES } from '@/src/shell/modules'

interface PageProps {
  params: Promise<{ module: string }>
}

const VALID = new Set(Object.keys(MODULES))

export default async function ModulePage({ params }: PageProps) {
  const { module } = await params
  if (!VALID.has(module)) notFound()

  const def = MODULES[module as keyof typeof MODULES]
  const { Body, ...moduleData } = def
  return (
    <ModuleFrame module={moduleData}>
      <Body />
    </ModuleFrame>
  )
}

export function generateStaticParams() {
  return Object.keys(MODULES).map((module) => ({ module }))
}
