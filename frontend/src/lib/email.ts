/**
 * AliBirds Email Dispatcher
 * Provides multi-channel invoice delivery:
 * 1. Direct 1-Click Gmail composer
 * 2. Direct 1-Click Outlook / Office 365 composer
 * 3. Native system email client (Mailto)
 * 4. Clipboard formatted invoice text
 * 5. Automated serverless Resend dispatch via Netlify Function
 */
import axios from 'axios'
import { Invoice, BusinessSettings } from './types'
import { fmt } from './api'

const STORAGE_KEY_RESEND = 'alibirds_resend_api_key'
const STORAGE_KEY_SENDER = 'alibirds_resend_sender'

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

export function isResendConfigured(): boolean {
  return true
}

export interface PreparedInvoiceEmail {
  recipient: string
  subject: string
  plainBody: string
  htmlBody: string
  totalAmount: number
}

/**
 * Prepares consistent email text, HTML and subject line for an invoice
 */
export function prepareInvoiceEmail(
  invoice: Invoice,
  settings?: BusinessSettings,
  recipientOverride?: string
): PreparedInvoiceEmail {
  const recipient = recipientOverride || invoice.client?.email || ''
  const companyName = settings?.company_name || 'AliBirds Studio'
  const totalAmount = Number(
    invoice.total_incl ??
    invoice.total_incl_vat ??
    invoice.line_items?.reduce((s, it) => s + (Number(it.line_total_incl || it.line_total_excl) || 0), 0) ??
    0
  )
  const clientName = invoice.client?.contact_person || invoice.client?.name || 'Klant'
  const dueDate = invoice.due_date ? fmt.date(invoice.due_date) : 'in overleg'
  const issueDate = invoice.issue_date ? fmt.date(invoice.issue_date) : fmt.date(new Date().toISOString())

  const subject = `Factuur ${invoice.invoice_number} — ${companyName}`

  const plainBody = `Beste ${clientName},

Hierbij ontvangt u factuur ${invoice.invoice_number} van ${companyName}.

Factuurgegevens:
- Factuurnummer: ${invoice.invoice_number}
- Factuurdatum: ${issueDate}
- Vervaldatum: ${dueDate}
- Totaalbedrag incl. btw: ${fmt.currency(totalAmount)}

Betaalinstructies:
Gelieve het bedrag vóór de vervaldatum (${dueDate}) over te maken naar:
- Rekeninghouder: ${companyName}
- IBAN: ${settings?.iban || 'NL00BANK0123456789'}
${settings?.bic ? `- BIC: ${settings.bic}\n` : ''}- Betalingskenmerk: ${invoice.invoice_number}

Heeft u vragen over deze factuur? Neem gerust contact met ons op.

Met vriendelijke groet,

${companyName}
${settings?.kvk_number ? `KvK: ${settings.kvk_number} | ` : ''}${settings?.btw_id || settings?.vat_number ? `BTW: ${settings.btw_id || settings.vat_number}\n` : '\n'}${settings?.phone ? `Tel: ${settings.phone}\n` : ''}${settings?.email ? `E-mail: ${settings.email}\n` : ''}`

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
      <div style="padding: 24px; border-bottom: 2px solid #e2e8f0;">
        <h2 style="margin: 0; color: ${settings?.accent_color || '#4f46e5'};">${companyName}</h2>
        <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Nieuwe factuur ${invoice.invoice_number}</p>
      </div>
      <div style="padding: 24px;">
        <p>Beste ${clientName},</p>
        <p>Hierbij ontvangt u factuur <strong>${invoice.invoice_number}</strong> van ${companyName}.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Factuurnummer:</td>
              <td style="text-align: right; font-weight: bold;">${invoice.invoice_number}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Factuurdatum:</td>
              <td style="text-align: right;">${issueDate}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Vervaldatum:</td>
              <td style="text-align: right;">${dueDate}</td>
            </tr>
            <tr style="border-top: 1px solid #cbd5e1;">
              <td style="padding-top: 10px; font-weight: bold; font-size: 15px;">Totaal incl. btw:</td>
              <td style="padding-top: 10px; text-align: right; font-weight: bold; font-size: 17px; color: ${settings?.accent_color || '#4f46e5'};">
                ${fmt.currency(totalAmount)}
              </td>
            </tr>
          </table>
        </div>

        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; font-size: 13px; color: #334155;">
          <strong>Betaalinstructies:</strong><br/>
          IBAN: <span style="font-family: monospace; font-weight: bold;">${settings?.iban || 'NL00BANK0123456789'}</span><br/>
          ${settings?.bic ? `BIC: <span style="font-family: monospace;">${settings.bic}</span><br/>` : ''}
          Omschrijving: <span style="font-family: monospace; font-weight: bold;">${invoice.invoice_number}</span>
        </div>

        <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
          Met vriendelijke groet,<br/>
          <strong>${companyName}</strong><br/>
          ${settings?.kvk_number ? `KvK: ${settings.kvk_number} | ` : ''}${settings?.btw_id || settings?.vat_number ? `BTW: ${settings.btw_id || settings.vat_number}` : ''}
        </p>
      </div>
    </div>
  `

  return { recipient, subject, plainBody, htmlBody, totalAmount }
}

/**
 * 1-Click Gmail Composer Deep Link
 */
export function generateGmailUrl(invoice: Invoice, settings?: BusinessSettings, recipientOverride?: string): string {
  const { recipient, subject, plainBody } = prepareInvoiceEmail(invoice, settings, recipientOverride)
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`
}

/**
 * 1-Click Outlook / Office 365 Web Composer Deep Link
 */
export function generateOutlookUrl(invoice: Invoice, settings?: BusinessSettings, recipientOverride?: string): string {
  const { recipient, subject, plainBody } = prepareInvoiceEmail(invoice, settings, recipientOverride)
  return `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(recipient)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`
}

/**
 * Standard Native Mailto Link (dispatches default desktop/mobile mail client)
 */
export function generateMailtoUrl(invoice: Invoice, settings?: BusinessSettings, recipientOverride?: string): string {
  const { recipient, subject, plainBody } = prepareInvoiceEmail(invoice, settings, recipientOverride)
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`
}

export interface SendResult {
  ok: boolean
  message: string
  isResendTestingRestriction?: boolean
}

/**
 * Dispatch invoice email via Netlify serverless function or Resend API.
 * Handles server-side CORS, detailed diagnostics, and sandbox restriction checks.
 */
export async function sendInvoiceViaResend(
  invoice: Invoice,
  settings?: BusinessSettings,
  recipientOverride?: string
): Promise<SendResult> {
  const { recipient, subject, htmlBody } = prepareInvoiceEmail(invoice, settings, recipientOverride)

  if (!recipient) {
    return { ok: false, message: 'Geen e-mailadres opgegeven voor deze ontvanger.' }
  }

  const apiKey = getResendKey()
  const sender = getResendSender()
  const companyName = settings?.company_name || 'AliBirds'
  const fromAddress = sender.includes('<') && sender.includes('>')
    ? sender
    : `${companyName} <${sender}>`

  // 1. Try serverless function endpoint first (handles server-side CORS cleanly)
  try {
    const res = await axios.post(
      '/api/send-email',
      {
        to: recipient,
        from: fromAddress,
        subject,
        html: htmlBody,
        apiKey,
      },
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (res.data?.ok) {
      return { ok: true, message: `Factuur succesvol verzonden naar ${recipient} via Resend!` }
    }
  } catch (err: any) {
    // If serverless function returned 403 due to Resend testing domain restriction:
    if (err.response?.data?.isResendTestingRestriction || err.response?.status === 403) {
      return {
        ok: false,
        isResendTestingRestriction: true,
        message: 'Resend testmodus kan alleen naar uw eigen account e-mail verzenden. Gebruik 1-klik Gmail of Outlook om direct vanuit uw eigen adres te sturen.',
      }
    }
    // If not a 404 (meaning function exists and responded with another error):
    if (err.response && err.response.status !== 404) {
      return {
        ok: false,
        message: err.response.data?.message || err.message || 'Verzenden mislukt.',
      }
    }
  }

  // 2. Fallback to direct Resend REST API (when testing with serverless proxy bypass)
  try {
    const res = await axios.post(
      'https://api.resend.com/emails',
      {
        from: fromAddress,
        to: [recipient],
        subject,
        html: htmlBody,
      },
      {
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (res.status === 200 || res.status === 201) {
      return { ok: true, message: `Factuur succesvol verzonden naar ${recipient} via Resend!` }
    }
    return { ok: false, message: 'Verzenden mislukt via Resend.' }
  } catch (err: any) {
    const status = err.response?.status
    const errorMsg = err.response?.data?.message || err.message || ''

    if (status === 403 || errorMsg.includes('testing emails to your own email address')) {
      return {
        ok: false,
        isResendTestingRestriction: true,
        message: 'Resend testmodus staat alleen verzenden toe naar uw eigen account e-mail. Gebruik Gmail, Outlook of Mailto om direct vanuit uw eigen adres te sturen.',
      }
    }

    // CORS error in direct browser call:
    if (!err.response && err.message?.includes('Network Error')) {
      return {
        ok: false,
        message: 'Browser beveiliging (CORS) blokkeert directe externe e-mail. Gebruik Gmail, Outlook of de Mailto knop hieronder.',
      }
    }

    return {
      ok: false,
      message: errorMsg || 'Fout bij verzenden via Resend.',
    }
  }
}
