import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import AppUpdatePrompt from './components/AppUpdatePrompt'
import { registerServiceWorker } from './lib/pwaPush'
import './index.css'

// Register Service Worker for PWA & Web Push
if (typeof window !== 'undefined') {
  registerServiceWorker()
}

// Guard against DOM manipulation by browser extensions/translators (Google Translate, Grammarly, etc.)
if (typeof Node === 'function' && Node.prototype) {
  const originalInsertBefore = Node.prototype.insertBefore
  ;(Node.prototype as any).insertBefore = function (newNode: Node, referenceNode: Node | null): Node {
    if (referenceNode && referenceNode.parentNode !== this) {
      return this.appendChild(newNode)
    }
    return originalInsertBefore.call(this, newNode, referenceNode)
  }

  const originalRemoveChild = Node.prototype.removeChild
  ;(Node.prototype as any).removeChild = function (child: Node): Node {
    if (child.parentNode !== this) {
      return child
    }
    return originalRemoveChild.call(this, child)
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
    },
  },
})

// Dynamic responsive toast positioning (top-center on mobile, bottom-right on desktop)
const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 768

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppUpdatePrompt />
        <App />
        <Toaster
          position={isMobileDevice ? 'top-center' : 'bottom-right'}
          containerStyle={isMobileDevice ? { top: '65px', padding: '0 12px' } : undefined}
          toastOptions={{
            style: {
              background: 'rgba(15, 23, 42, 0.88)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
              fontSize: '13px',
              padding: '10px 16px',
            },
          }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
