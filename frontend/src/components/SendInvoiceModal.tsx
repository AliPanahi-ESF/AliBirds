import React, { useState, useEffect } from 'react'
import {
  Mail, X, Check, Copy, ExternalLink, AlertCircle,
  Sparkles, Send, Download, FileText, Link as LinkIcon,
  CheckCircle, ChevronDown, ChevronUp
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Invoice, BusinessSettings, Client } from '@/lib/types'
import { fmt, clientsApi, invoicesApi, settingsApi } from '@/lib/api'
import {
  prepareInvoiceEmail,
  generateGmailUrl,
  generateOutlookUrl,
  generateMailtoUrl,
  sendInvoiceViaResend,
  getDefaultPaymentLink,
  saveDefaultPaymentLink,
} from '@/lib/email'
import { downloadInvoicePdf } from '@/lib/pdfGenerator'
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
  const [paymentLink, setPaymentLink] = useState('')
  const [saveToProfile, setSaveToProfile] = useState(true)
  const [savePayLinkAsDefault, setSavePayLinkAsDefault] = useState(true)
  const [isSendingResend, setIsSendingResend] = useState(false)
  const [copied, setCopied] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

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
      const existingPayLink = invoice.payment_link || settings?.payment_link || getDefaultPaymentLink() || ''
      setPaymentLink(existingPayLink)
      setResendError(null)
      setCopied(false)
    }
  }, [isOpen, resolvedClient, settings, invoice])

  if (!isOpen) return null

  const markInvoiceAsSent = async () => {
    try {
      if (invoice.id && !invoice.id.startsWith('new-')) {
        await invoicesApi.update(invoice.id, { status: 'SENT', sent_at: new Date().toISOString() })
        qc.invalidateQueries({ queryKey: ['invoice', invoice.id] })
        qc.invalidateQueries({ queryKey: ['invoices'] })
      }
      onSuccess?.()
    } catch (e) {
      console.warn('Could not update invoice status to SENT:', e)
    }
  }

  const handleSavePreferences = async (email: string) => {
    if (savePayLinkAsDefault && paymentLink.trim()) {
      saveDefaultPaymentLink(paymentLink.trim())
      try {
        await settingsApi.update({ payment_link: paymentLink.trim() })
        qc.invalidateQueries({ queryKey: ['settings'] })
      } catch {
        // ignore
      }
    }
    if (saveToProfile && resolvedClient?.id && email.includes('@')) {
      try {
        await clientsApi.update(resolvedClient.id, { email })
        qc.invalidateQueries({ queryKey: ['clients'] })
      } catch (e) {
        console.warn('Could not save email to client profile:', e)
      }
    }
  }

  // 1-Click: Download PDF
  const handleDownloadPdf = () => {
    try {
      downloadInvoicePdf(invoice, resolvedClient, settings, paymentLink.trim())
      toast.success(`Factuur PDF gedownload!`)
    } catch (err: any) {
      toast.error('Kon PDF niet genereren.')
    }
  }

  // 1-Click: Open in Gmail Web
  const handleOpenGmail = async () => {
    const email = recipientEmail.trim()
    await handleSavePreferences(email)
    const gmailUrl = generateGmailUrl(invoice, settings, email, paymentLink.trim())
    window.open(gmailUrl, '_blank', 'noopener,noreferrer')
    toast.success('Gmail geopend met korte betaalmail! Voeg eventueel de PDF-bijlage toe.')
    await markInvoiceAsSent()
    onClose()
  }

  // 1-Click: Open in Outlook Web
  const handleOpenOutlook = async () => {
    const email = recipientEmail.trim()
    await handleSavePreferences(email)
    const outlookUrl = generateOutlookUrl(invoice, settings, email, paymentLink.trim())
    window.open(outlookUrl, '_blank', 'noopener,noreferrer')
    toast.success('Outlook geopend met korte betaalmail!')
    await markInvoiceAsSent()
    onClose()
  }

  // 1-Click: Open Default System Mail Client (Mailto)
  const handleOpenMailto = async () => {
    const email = recipientEmail.trim()
    await handleSavePreferences(email)
    const mailto = generateMailtoUrl(invoice, settings, email, paymentLink.trim())
    window.location.href = mailto
    toast.success('E-mailapp geopend met korte betaalmail!')
    await markInvoiceAsSent()
    onClose()
  }

  // 1-Click: Copy Formatted Text to Clipboard
  const handleCopyText = async () => {
    const email = recipientEmail.trim()
    await handleSavePreferences(email)
    const { plainBody } = prepareInvoiceEmail(invoice, settings, email, paymentLink.trim())
    try {
      await navigator.clipboard.writeText(plainBody)
      setCopied(true)
      toast.success('E-mailtekst gekopieerd naar klembord!')
      setTimeout(() => setCopied(false), 3000)
    } catch {
      toast.error('Kopiëren mislukt.')
    }
  }

  // Direct Serverless Resend Dispatch with PDF attachment & Payment Link
  const handleSendViaResend = async () => {
    const email = recipientEmail.trim()
    if (!email || !email.includes('@')) {
      toast.error('Vul een geldig e-mailadres in.')
      return
    }

    setIsSendingResend(true)
    setResendError(null)

    try {
      await handleSavePreferences(email)

      const res = await sendInvoiceViaResend(
        { ...invoice, client: { ...(resolvedClient || ({} as Client)), email } },
        settings,
        email,
        paymentLink.trim()
      )

      if (res.ok) {
        toast.success(res.message || `Factuur met PDF-bijlage verzonden naar ${email}!`)
        await markInvoiceAsSent()
        onClose()
      } else {
        setResendError(res.message)
        toast.error(res.message, { duration: 6000 })
      }
    } catch (err: any) {
      setResendError(err.message || 'Verzenden via Resend is mislukt.')
      toast.error(err.message || 'Verzenden mislukt.')
    } finally {
      setIsSendingResend(false)
    }
  }

  const { plainBody, subject } = prepareInvoiceEmail(
    invoice,
    settings,
    recipientEmail.trim(),
    paymentLink.trim()
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Factuur Verzenden</h2>
              <p className="text-xs text-slate-400">Verstuur PDF-factuur {invoice.invoice_number} direct met betaallink</p>
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
        <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
          <div>
            <div className="font-semibold text-slate-200">{resolvedClient?.name || 'Klant'}</div>
            <div className="text-slate-400 font-mono text-[11px]">Factuurnummer: {invoice.invoice_number}</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-emerald-400 text-sm font-mono">{fmt.currency(totalAmount)}</div>
            <div className="text-[11px] text-slate-400">Vervalt {fmt.date(invoice.due_date)}</div>
          </div>
        </div>

        {/* Recipient Email Field */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300">
            E-mailadres ontvanger *
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="bijv. administratie@klant.nl"
            className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 font-mono transition-all"
            autoFocus
          />

          {!resolvedClient?.email && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
              <AlertCircle size={13} className="shrink-0" />
              <span>Deze klant heeft nog geen e-mailadres in het adressenbestand.</span>
            </div>
          )}

          {resolvedClient?.id && (
            <label className="flex items-center gap-2 pt-0.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveToProfile}
                onChange={(e) => setSaveToProfile(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
              />
              <span className="text-xs text-slate-300">
                E-mailadres opslaan in klantprofiel van <strong>{resolvedClient.name}</strong>
              </span>
            </label>
          )}
        </div>

        {/* Direct Payment Link Field */}
        <div className="space-y-1.5 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <LinkIcon size={13} className="text-emerald-400" />
              Directe Betaallink (iDEAL / Bunq / Tikkie)
            </label>
            <span className="text-[10px] text-slate-400">Optioneel</span>
          </div>
          <input
            type="url"
            value={paymentLink}
            onChange={(e) => setPaymentLink(e.target.value)}
            placeholder="bijv. https://bunq.me/uwbedrijf of https://tikkie.me/..."
            className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono transition-all"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
            <span>Wordt als klikbare iDEAL-betaalknop meegestuurd in de e-mail.</span>
            {paymentLink.trim() && (
              <label className="flex items-center gap-1 text-[10px] text-emerald-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={savePayLinkAsDefault}
                  onChange={(e) => setSavePayLinkAsDefault(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 h-3 w-3"
                />
                <span>Onthouden</span>
              </label>
            )}
          </div>
        </div>

        {/* PDF Attachment Badge & Download Button */}
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileText size={15} />
            </div>
            <div>
              <div className="font-semibold text-slate-200">Factuur-{invoice.invoice_number}.pdf</div>
              <div className="text-[10px] text-slate-400">Wettelijk conforme A4 factuur</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Download PDF om handmatig toe te voegen of in te zien"
          >
            <Download size={12} />
            <span>Download PDF</span>
          </button>
        </div>

        {/* Resend Error Banner if test restriction occurs */}
        {resendError && (
          <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl space-y-1 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <AlertCircle size={14} className="shrink-0" />
              <span>Resend melding</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {resendError}
            </p>
            <div className="text-[11px] text-amber-300/90 pt-0.5">
              👉 <strong>Tip:</strong> Gebruik hieronder <strong>Gmail</strong> of <strong>Outlook</strong> om de factuur direct vanaf uw eigen adres te versturen!
            </div>
          </div>
        )}

        {/* 1-Click Sending Options */}
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Verzenden vanaf uw eigen e-mail (1-Klik met betaallink)
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Gmail Web */}
            <button
              type="button"
              onClick={handleOpenGmail}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-700 hover:border-red-500/50 hover:bg-red-950/10 text-left transition-all flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 group-hover:scale-105 transition-transform">
                <Mail size={16} />
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-slate-200 group-hover:text-red-400 transition-colors">
                  Open in Gmail
                </div>
                <div className="text-[10px] text-slate-400 truncate">Met betaallink</div>
              </div>
            </button>

            {/* Outlook Web */}
            <button
              type="button"
              onClick={handleOpenOutlook}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-700 hover:border-blue-500/50 hover:bg-blue-950/10 text-left transition-all flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                <Mail size={16} />
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                  Open in Outlook
                </div>
                <div className="text-[10px] text-slate-400 truncate">Met betaallink</div>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Default Mail App (Mailto) */}
            <button
              type="button"
              onClick={handleOpenMailto}
              className="p-2 rounded-lg bg-slate-950/50 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <ExternalLink size={13} />
              <span>Standaard mailapp</span>
            </button>

            {/* Copy Text */}
            <button
              type="button"
              onClick={handleCopyText}
              className="p-2 rounded-lg bg-slate-950/50 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? 'Gekopieerd!' : 'Kopieer e-mailtekst'}</span>
            </button>
          </div>
        </div>

        {/* Direct Cloud Resend Option with PDF Attachment */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Geautomatiseerde cloud-verzending</span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <Sparkles size={11} /> Resend + PDF bijlage
            </span>
          </div>

          <button
            type="button"
            onClick={handleSendViaResend}
            disabled={isSendingResend || !recipientEmail}
            className="w-full btn-primary py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2 font-semibold shadow-lg shadow-brand-500/10 disabled:opacity-50"
          >
            <Send size={14} />
            <span>{isSendingResend ? 'Verzenden met PDF-bijlage...' : 'Verzenden via Resend Cloud (inclusief PDF-bijlage)'}</span>
          </button>
        </div>

        {/* Collapsible Short Email Preview */}
        <div className="border-t border-slate-800/60 pt-2">
          <button
            type="button"
            onClick={() => setShowPreview(p => !p)}
            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <span>{showPreview ? 'E-mailvoorbeeld verbergen' : 'Bekijk korte e-mailtekst'}</span>
            {showPreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showPreview && (
            <div className="mt-2 p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-mono whitespace-pre-line max-h-44 overflow-y-auto leading-relaxed">
              <div className="text-slate-400 font-bold mb-1 border-b border-slate-800 pb-1">
                Onderwerp: {subject}
              </div>
              {plainBody}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
