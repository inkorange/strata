import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Geist } from 'next/font/google'
import { cn } from '@/lib/utils'
import { PersistentScene } from '@/src/scene/PersistentScene'
import { ServiceWorkerRegister } from './sw-register'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

const SITE_NAME = 'Strata'
const SITE_TITLE = 'Strata — Drift plates, form weather, cycle carbon in 3D'
const SITE_DESCRIPTION =
  'A free, interactive 3D earth-science playground. Drift tectonic plates and watch mountains rise, form fronts and storms, and cycle carbon between reservoirs — rendered with game-quality realism.'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s · Strata',
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'Chris West' }],
  creator: 'Chris West',
  publisher: 'Strata',
  keywords: [
    'earth science',
    'plate tectonics',
    'meteorology',
    'carbon cycle',
    '3D earth science',
    'science education',
    'interactive geology',
    'STEM',
    'AI tutor',
  ],
  category: 'education',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/applogo.png',
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    images: [{ url: '/applogo.png', alt: 'Strata' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/applogo.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#07051a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body className="bg-[#07051a] text-[#dffaff] antialiased">
        <ServiceWorkerRegister />
        <PersistentScene />
        {children}
      </body>
    </html>
  )
}
