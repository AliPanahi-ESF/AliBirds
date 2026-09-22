/**
 * AliBirds Email Dispatcher
 * Provides multi-channel invoice delivery:
 * 1. Direct 1-Click Gmail composer
 * 2. Direct 1-Click Outlook / Office 365 composer
 * 3. Native system email client (Mailto)
 * 4. Clipboard formatted invoice text
 * 5. Automated serverless Resend dispatch via Netlify Function with PDF attachment & payment link
 */
import axios from 'axios'
import { Invoice, BusinessSettings } from './types'
import { fmt } from './api'
import { generateInvoicePdfBase64 } from './pdfGenerator'

const STORAGE_KEY_RESEND = 'alibirds_resend_api_key'
const STORAGE_KEY_SENDER = 'alibirds_resend_sender'
const STORAGE_KEY_PAYLINK = 'alibirds_default_payment_link'

// Default built-in Resend API credentials (base64 encoded)
const DEFAULT_RESEND_KEY = typeof atob !== 'undefined' ? atob('cmVfUnpMWHI1NmNfRUhnYmhiRk5UMlFpR0JUeEVKVHIyTmZ3') : ''
const DEFAULT_RESEND_SENDER = 'onboarding@resend.dev'

export function getResendKey(): string {
  try {
    return (
      import.meta.env.VITE_RESEND_API_KEY ||
      localStorage.getItem(STORAGE_KEY_RESEND) ||
      DEFAULT_RESEND_KEY
    )
  } catch {
    return DEFAULT_RESEND_KEY
  }
}

export function saveResendConfig(apiKey: string, senderEmail?: string): void {
  localStorage.setItem(STORAGE_KEY_RESEND, apiKey.trim())
  if (senderEmail) {
    localStorage.setItem(STORAGE_KEY_SENDER, senderEmail.trim())
  }
}

export function getResendSender(): string {
  try {
    return (
      localStorage.getItem(STORAGE_KEY_SENDER) ||
      import.meta.env.VITE_RESEND_FROM_EMAIL ||
      DEFAULT_RESEND_SENDER
    )
  } catch {
    return DEFAULT_RESEND_SENDER
  }
}

export function getDefaultPaymentLink(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_PAYLINK) || ''
  } catch {
    return ''
  }
}

export function saveDefaultPaymentLink(link: string): void {
  try {
    if (link) {
      localStorage.setItem(STORAGE_KEY_PAYLINK, link.trim())
    } else {
      localStorage.removeItem(STORAGE_KEY_PAYLINK)
    }
  } catch {
    // ignore
  }
}

export function isResendConfigured(): boolean {
  return true
}

export interface PreparedInvoiceEmail {
  recipient: string
  subject: string
  plainBody: string
  htmlBody: string
  totalAmount: number
  paymentLink?: string
}

/**
 * Prepares short, concise, professional email text and HTML for an invoice
 * Designed for quick payment with direct payment link and PDF attachment
 */
export function prepareInvoiceEmail(
  invoice: Invoice,
  settings?: BusinessSettings,
  recipientOverride?: string,
  paymentLinkOverride?: string
): PreparedInvoiceEmail {
  const recipient = recipientOverride || invoice.client?.email || ''
  const companyName = settings?.company_name || 'Studio AliBirds'
  const totalAmount = Number(
    invoice.total_incl ??
    invoice.total_incl_vat ??
    invoice.line_items?.reduce((s, it) => s + (Number(it.line_total_incl || it.line_total_excl) || 0), 0) ??
    0
  )
  const clientName = invoice.client?.contact_person || invoice.client?.name || 'Klant'
  const dueDate = invoice.due_date ? fmt.date(invoice.due_date) : 'in overleg'

  const subject = `Factuur ${invoice.invoice_number} — ${companyName}`
  const payLink = paymentLinkOverride || getDefaultPaymentLink()

  // ── Nice & Short Plain Text Message (For Gmail, Outlook, Mailto, WhatsApp) ──
  let plainBody = `Beste ${clientName},

Hierbij ontvangt u factuur ${invoice.invoice_number} van ${companyName} ter hoogte van ${fmt.currency(totalAmount)}.
De factuur is als PDF-bijlage toegevoegd.

Gelieve het bedrag vóór ${dueDate} te voldoen.`

  if (payLink) {
    plainBody += `\n\n👉 Direct online betalen (iDEAL / Betaallink):\n${payLink}`
  }

  plainBody += `\n\nOf via bankoverschrijving naar:\nRekeninghouder: ${companyName}\nIBAN: ${settings?.iban || 'Zie factuur'}\nBetalingskenmerk: ${invoice.invoice_number}`

  plainBody += `\n\nMet vriendelijke groet,\n\n${companyName}`
  const footerContact = [settings?.phone, settings?.email].filter(Boolean).join(' | ')
  if (footerContact) {
    plainBody += `\n${footerContact}`
  }

  // ── Crisp, Professional Responsive HTML Card ────────────────────────────────
  const accentColor = settings?.accent_color || '#4f46e5'
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="padding: 20px 24px; background: #0f172a; color: #ffffff;">
        <h2 style="margin: 0; font-size: 17px; font-weight: 700; color: #f8fafc;">${companyName}</h2>
        <p style="margin: 3px 0 0 0; font-size: 13px; color: #94a3b8;">Factuur ${invoice.invoice_number}</p>
      </div>

      <div style="padding: 24px;">
        <p style="font-size: 15px; margin-top: 0;">Beste ${clientName},</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.5;">
          Hierbij ontvangt u factuur <strong>${invoice.invoice_number}</strong>. De factuur is als PDF-bijlage bijgevoegd.
        </p>

        <!-- Summary & Amount Box -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Totaal te voldoen</div>
          <div style="font-size: 26px; font-weight: 800; color: ${accentColor}; margin: 4px 0;">
            ${fmt.currency(totalAmount)}
          </div>
          <div style="font-size: 12px; color: #64748b;">Vervaldatum: <strong>${dueDate}</strong></div>
        </div>

        ${payLink ? `
        <!-- Direct Payment Link Button -->
        <div style="text-align: center; margin: 24px 0;">
          <a href="${payLink}" style="background-color: #10b981; color: #ffffff; padding: 13px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; display: inline-block;">
            💳 Direct online betalen (iDEAL) &rarr;
          </a>
          <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Snel en veilig betalen via betaallink</div>
        </div>
        ` : ''}

        <!-- Bank Details Box -->
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 16px; font-size: 13px; color: #334155; line-height: 1.6;">
          <div style="font-weight: 700; margin-bottom: 4px; color: #0f172a;">Overschrijven per bank:</div>
          <div>IBAN: <strong style="font-family: monospace;">${settings?.iban || 'Zie factuur'}</strong></div>
          ${settings?.bic ? `<div>BIC: <span style="font-family: monospace;">${settings.bic}</span></div>` : ''}
          <div>Betalingskenmerk: <strong style="font-family: monospace;">${invoice.invoice_number}</strong></div>
        </div>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; line-height: 1.5;">
          Met vriendelijke groet,<br/>
          <strong style="color: #0f172a;">${companyName}</strong><br/>
          ${settings?.kvk_number ? `KvK: ${settings.kvk_number} | ` : ''}${settings?.btw_id || settings?.vat_number ? `BTW: ${settings.btw_id || settings.vat_number}` : ''}
        </div>
      </div>
    </div>
  `

  return { recipient, subject, plainBody, htmlBody, totalAmount, paymentLink: payLink }
}

/**
 * 1-Click Gmail Composer Deep Link
 */
export function generateGmailUrl(
  invoice: Invoice,
  settings?: BusinessSettings,
  recipientOverride?: string,
  paymentLink?: string
): string {
  const { recipient, subject, plainBody } = prepareInvoiceEmail(invoice, settings, recipientOverride, paymentLink)
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`
}

/**
 * 1-Click Outlook / Office 365 Web Composer Deep Link
 */
export function generateOutlookUrl(
  invoice: Invoice,
  settings?: BusinessSettings,
  recipientOverride?: string,
  paymentLink?: string
): string {
  const { recipient, subject, plainBody } = prepareInvoiceEmail(invoice, settings, recipientOverride, paymentLink)
  return `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(recipient)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`
}

/**
 * Standard Native Mailto Link (dispatches default desktop/mobile mail client)
 */
export function generateMailtoUrl(
  invoice: Invoice,
  settings?: BusinessSettings,
  recipientOverride?: string,
  paymentLink?: string
): string {
  const { recipient, subject, plainBody } = prepareInvoiceEmail(invoice, settings, recipientOverride, paymentLink)
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`
}

export interface SendResult {
  ok: boolean
  message: string
  isResendTestingRestriction?: boolean
}

/**
 * Dispatch invoice email via Netlify serverless function with PDF attachment.
 * Automatically generates the vector PDF and attaches it as Factuur-[number].pdf.
 */
export async function sendInvoiceViaResend(
  invoice: Invoice,
  settings?: BusinessSettings,
  recipientOverride?: string,
  paymentLinkOverride?: string
): Promise<SendResult> {
  const { recipient, subject, htmlBody } = prepareInvoiceEmail(
    invoice,
    settings,
    recipientOverride,
    paymentLinkOverride
  )

  if (!recipient) {
    return { ok: false, message: 'Geen e-mailadres opgegeven voor deze ontvanger.' }
  }

  const apiKey = getResendKey()
  const sender = getResendSender()
  const companyName = settings?.company_name || 'AliBirds'
  const fromAddress = sender.includes('<') && sender.includes('>')
    ? sender
    : `${companyName} <${sender}>`

  // Generate vector PDF attachment
  let attachments: Array<{ filename: string; content: string }> = []
  try {
    const pdfBase64 = generateInvoicePdfBase64(
      invoice,
      invoice.client,
      settings,
      paymentLinkOverride
    )
    if (pdfBase64) {
      attachments.push({
        filename: `Factuur-${invoice.invoice_number || 'AliBirds'}.pdf`,
        content: pdfBase64,
      })
    }
  } catch (err) {
    console.warn('Could not generate PDF attachment for Resend:', err)
  }

  // 1. Try serverless function endpoint first (handles server-side CORS & attachments cleanly)
  try {
    const res = await axios.post(
      '/api/send-email',
      {
        to: recipient,
        from: fromAddress,
        subject,
        html: htmlBody,
        apiKey,
        attachments,
      },
      {
        timeout: 12000,
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (res.data?.ok) {
      return { ok: true, message: `Factuur met PDF-bijlage succesvol verzonden naar ${recipient}!` }
    }
  } catch (err: any) {
    // If serverless function returned 403 due to Resend testing domain restriction:
    if (err.response?.data?.isResendTestingRestriction || err.response?.status === 403) {
      return {
        ok: false,
        isResendTestingRestriction: true,
        message: 'Resend testmodus kan alleen naar uw eigen account e-mail verzenden. Gebruik 1-klik Gmail of Outlook om direct vanaf uw eigen adres te sturen.',
      }
    }
    // If not a 404:
    if (err.response && err.response.status !== 404) {
      return {
        ok: false,
        message: err.response.data?.message || err.message || 'Verzenden mislukt.',
      }
    }
  }

  // 2. Fallback direct Resend REST API (if function not reachable)
  try {
    const payload: any = {
      from: fromAddress,
      to: [recipient],
      subject,
      html: htmlBody,
    }
    if (attachments.length > 0) {
      payload.attachments = attachments
    }

    const res = await axios.post('https://api.resend.com/emails', payload, {
      timeout: 12000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (res.status === 200 || res.status === 201) {
      return { ok: true, message: `Factuur met PDF succesvol verzonden naar ${recipient} via Resend!` }
    }
    return { ok: false, message: 'Verzenden mislukt via Resend.' }
  } catch (err: any) {
    const status = err.response?.status
    const errorMsg = err.response?.data?.message || err.message || ''

    if (status === 403 || errorMsg.includes('testing emails to your own email address')) {
      return {
        ok: false,
        isResendTestingRestriction: true,
        message: 'Resend testmodus staat alleen verzenden toe naar uw eigen account e-mail. Gebruik Gmail, Outlook of Mailto om direct vanaf uw eigen adres te sturen.',
      }
    }

    if (!err.response && err.message?.includes('Network Error')) {
      return {
        ok: false,
        message: 'Browser CORS blokkeert directe externe e-mail. Gebruik Gmail, Outlook of de Mailto knop hieronder.',
      }
    }

    return {
      ok: false,
      message: errorMsg || 'Fout bij verzenden via Resend.',
    }
  }
}
