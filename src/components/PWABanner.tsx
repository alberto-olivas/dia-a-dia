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
      className="fixed bottom-24 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 p-4 flex items-start gap-4 rounded-2xl"
      style={{ background: '#FFFFFF', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
    >
      <div
        className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: '#FFF4EF' }}
      >
        {isMobile
          ? <Smartphone size={18} style={{ color: '#FF6B35' }} />
          : <Download size={18} style={{ color: '#FF6B35' }} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-gray-900">
          {isMobile ? 'Añadir a pantalla de inicio' : 'Instalar app en tu escritorio'}
        </p>
        <p className="text-xs mt-0.5 text-gray-400">
          Acceso rápido, sin navegador
        </p>
        <button
          onClick={handleInstall}
          className="mt-3 px-4 py-2 text-xs font-bold tracking-widest uppercase rounded-lg"
          style={{ background: '#FF6B35', color: '#ffffff' }}
        >
          {isMobile ? 'Añadir' : 'Instalar'}
        </button>
      </div>

      <button onClick={dismiss} className="shrink-0 p-1 text-gray-300 hover:text-gray-500 transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}
