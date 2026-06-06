import type { Metadata, Viewport } from 'next'
import { Barlow } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-barlow',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Día a Día',
  description: 'Tu compañero de seguimiento diario',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Día a Día',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={barlow.variable}>
      <body style={{ fontFamily: 'var(--font-barlow), Barlow, system-ui, sans-serif' }}>
        <AuthProvider>
          {children}
          <ServiceWorkerRegistration />
        </AuthProvider>
      </body>
    </html>
  )
}
