import type { Metadata, Viewport } from 'next'
import { Oswald, Poppins, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ThemeProvider } from '@/lib/theme-context'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-poppins',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Día a Día',
  description: 'Tu compañero de seguimiento diario',
  icons: {
    icon: [{ url: '/icon-192x192.png', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
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
  themeColor: '#EDF2F7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${oswald.variable} ${poppins.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies saved theme before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`
          }}
        />
      </head>
      <body
        style={{ fontFamily: "var(--font-poppins), 'Poppins', system-ui, sans-serif" }}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthProvider>
            {children}
            <ServiceWorkerRegistration />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
