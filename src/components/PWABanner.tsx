'use client'

import { useState, useEffect } from 'react'
import { X, Download, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'pwa-banner-dismissed'

export default function PWABanner() {
  const [show, setShow] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Don't show if already dismissed or app is already installed
    if (localStorage.getItem(STORAGE_KEY)) return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    setIsMobile(mobile)

    const handlePrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        dismiss()
      }
    }
  }

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 p-4 flex items-start gap-4"
      style={{ background: '#111111', border: '1px solid #2a2a2a' }}
    >
      <div
        className="shrink-0 w-10 h-10 flex items-center justify-center"
        style={{ background: 'rgba(255,45,0,0.1)', border: '1px solid rgba(255,45,0,0.3)' }}
      >
        {isMobile
          ? <Smartphone size={18} style={{ color: '#FF2D00' }} />
          : <Download size={18} style={{ color: '#FF2D00' }} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm" style={{ color: '#ffffff' }}>
          {isMobile ? 'Añadir a pantalla de inicio' : 'Instalar app en tu escritorio'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#555555' }}>
          Acceso rápido, sin navegador
        </p>
        <button
          onClick={handleInstall}
          className="mt-3 px-4 py-2 text-xs font-bold tracking-widest uppercase"
          style={{ background: '#FF2D00', color: '#ffffff' }}
        >
          {isMobile ? 'Añadir' : 'Instalar'}
        </button>
      </div>

      <button
        onClick={dismiss}
        className="shrink-0 p-1 transition-colors"
        style={{ color: '#555555' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
