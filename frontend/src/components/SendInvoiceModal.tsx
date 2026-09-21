import React, { useState, useEffect } from 'react'
import { Send, Mail, X, CheckCircle, ExternalLink, AlertCircle, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { Invoice, BusinessSettings, Client } from '@/lib/types'
import { fmt, clientsApi, invoicesApi } from '@/lib/api'
import { sendInvoiceViaResend, generateMailtoUrl, isResendConfigured } from '@/lib/email'
import { useQueryClient } from '@tanstack/react-query'

interface SendInvoiceModalProps {
  invoice: Invoice
  client?: Client
  settings?: BusinessSettings
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function SendInvoiceModal({
  invoice,
  client,
  settings,
  isOpen,
  onClose,
  onSuccess,
}: SendInvoiceModalProps) {
  const qc = useQueryClient()
  const [recipientEmail, setRecipientEmail] = useState('')
  const [saveToProfile, setSaveToProfile] = useState(true)
  const [isSending, setIsSending] = useState(false)

  const resolvedClient = client || (invoice.client as Client | undefined)
  const totalAmount = Number(
    invoice.total_incl ??
    invoice.total_incl_vat ??
    invoice.line_items?.reduce((s, it) => s + (Number(it.line_total_incl || it.line_total_excl) || 0), 0) ??
    0
  )

  useEffect(() => {
    if (isOpen) {
      setRecipientEmail(resolvedClient?.email || '')
      setSaveToProfile(!resolvedClient?.email)
    }
  }, [isOpen, resolvedClient])

  if (!isOpen) return null

  const handleSendViaResend = async () => {
    const email = recipientEmail.trim()
    if (!email || !email.includes('@')) {
      toast.error('Vul een geldig e-mailadres in.')
      return
    }

    setIsSending(true)
    try {
      // 1. Optionally save email to client profile
      if (saveToProfile && resolvedClient?.id) {
        try {
          await clientsApi.update(resolvedClient.id, { email })
          qc.invalidateQueries({ queryKey: ['clients'] })
        } catch (e) {
          console.warn('Could not save email to client profile:', e)
        }
      }

      // 2. Dispatch email via Resend
      const res = await sendInvoiceViaResend(
        { ...invoice, client: { ...(resolvedClient || ({} as Client)), email } },
        settings,
        email
      )

      if (res.ok) {
        toast.success(`Factuur succesvol verzonden naar ${email}!`)
        // Update invoice status to SENT
        if (invoice.id && !invoice.id.startsWith('new-')) {
          await invoicesApi.update(invoice.id, { status: 'SENT', sent_at: new Date().toISOString() })
          qc.invalidateQueries({ queryKey: ['invoice', invoice.id] })
          qc.invalidateQueries({ queryKey: ['invoices'] })
        }
        onSuccess?.()
        onClose()
      } else {
        toast.error(res.message)
        // Offer mailto fallback
        const mailto = generateMailtoUrl(invoice, settings, email)
        window.open(mailto, '_blank')
      }
    } catch (err: any) {
      toast.error(err.message || 'Verzenden mislukt')
    } finally {
      setIsSending(false)
    }
  }

  const handleSendViaMailto = async () => {
    const email = recipientEmail.trim()
    if (saveToProfile && email && email.includes('@') && resolvedClient?.id) {
      try {
        await clientsApi.update(resolvedClient.id, { email })
        qc.invalidateQueries({ queryKey: ['clients'] })
      } catch {
        // ignore
      }
    }

    const mailto = generateMailtoUrl(invoice, settings, email)
    window.open(mailto, '_blank')
    toast('E-mailconcept geopend in uw e-mailprogramma!', { icon: '✉️' })

    if (invoice.id && !invoice.id.startsWith('new-')) {
      await invoicesApi.update(invoice.id, { status: 'SENT', sent_at: new Date().toISOString() })
      qc.invalidateQueries({ queryKey: ['invoice', invoice.id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    }
    onSuccess?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Factuur Verzenden</h2>
              <p className="text-xs text-slate-400">Verzend factuur {invoice.invoice_number} direct naar de klant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Invoice Summary Pill */}
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <div className="font-semibold text-slate-200">{resolvedClient?.name || 'Onbekende klant'}</div>
            <div className="text-slate-400 font-mono text-[11px]">Factuur: {invoice.invoice_number}</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-slate-100 text-sm font-mono">{fmt.currency(totalAmount)}</div>
            <div className="text-[11px] text-slate-400">Vervalt {fmt.date(invoice.due_date)}</div>
          </div>
        </div>

        {/* Recipient Email Field */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            E-mailadres ontvanger *
          </label>
          <div className="relative">
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="bijv. administratie@klant.nl"
              className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 font-mono transition-all"
              autoFocus
            />
          </div>

          {!resolvedClient?.email && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
              <AlertCircle size={14} className="shrink-0" />
              <span>Deze klant heeft nog geen e-mailadres geregistreerd.</span>
            </div>
          )}

          {resolvedClient?.id && (
            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveToProfile}
                onChange={(e) => setSaveToProfile(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-brand-600 focus:ring-brand-500 h-4 w-4"
              />
              <span className="text-xs text-slate-300">
                Dit e-mailadres opslaan in klantprofiel van <strong>{resolvedClient.name}</strong>
              </span>
            </label>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleSendViaResend}
            disabled={isSending || !recipientEmail}
            className="w-full btn-primary py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2 font-semibold shadow-lg shadow-brand-500/10 disabled:opacity-50"
          >
            <Send size={15} />
            <span>{isSending ? 'Verzenden via Resend...' : 'Direct verzenden (Resend e-mail)'}</span>
          </button>

          <button
            type="button"
            onClick={handleSendViaMailto}
            disabled={isSending}
            className="w-full btn-secondary py-2 text-xs flex items-center justify-center gap-2 text-slate-300 hover:text-white"
          >
            <ExternalLink size={14} />
            <span>Openen in e-mailprogramma (Mailto)</span>
          </button>
        </div>

      </div>
    </div>
  )
}
