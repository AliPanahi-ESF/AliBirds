import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { registerServiceWorker } from './lib/pwaPush'
import './index.css'

// Register Service Worker for PWA & Web Push
if (typeof window !== 'undefined') {
  registerServiceWorker()
}

// Guard against DOM manipulation by browser extensions/translators (Google Translate, Grammarly, etc.)
if (typeof Node === 'function' && Node.prototype) {
  const originalInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function (newNode: Node, referenceNode: Node | null): Node {
    if (referenceNode && referenceNode.parentNode !== this) {
      return this.appendChild(newNode)
    }
    return originalInsertBefore.call(this, newNode, referenceNode)
  }

  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function (child: Node): Node {
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#0f172a',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '10px',
              fontSize: '13px',
            },
          }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
