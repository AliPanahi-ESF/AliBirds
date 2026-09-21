/**
 * AliBirds Email Dispatcher
 * Supports free transactional email dispatch via Resend API or client mailto fallback.
 */
import axios from 'axios'
import { Invoice, BusinessSettings } from './types'
import { fmt } from './api'

const STORAGE_KEY_RESEND = 'alibirds_resend_api_key'
const STORAGE_KEY_SENDER = 'alibirds_resend_sender'

export function getResendKey(): string | null {
  try {
    return import.meta.env.VITE_RESEND_API_KEY || localStorage.getItem(STORAGE_KEY_RESEND) || null
  } catch {
    return null
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
      'facturen@resend.dev'
    )
  } catch {
    return 'facturen@resend.dev'
  }
}

export function isResendConfigured(): boolean {
  const key = getResendKey()
  return !!(key && key.startsWith('re_'))
}

/**
 * Generate Mailto link as a 100% reliable zero-configuration fallback
 */
export function generateMailtoUrl(invoice: Invoice, settings?: BusinessSettings): string {
  const recipient = invoice.client?.email || ''
  const companyName = settings?.company_name || 'AliBirds Studio'
  const subject = encodeURIComponent(`Factuur ${invoice.invoice_number} — ${companyName}`)
  const body = encodeURIComponent(
    `Beste ${invoice.client?.contact_person || invoice.client?.name || 'relatie'},\n\n` +
    `Hierbij ontvangt u factuur ${invoice.invoice_number} ter hoogte van ${fmt.currency(invoice.total_incl)}.\n\n` +
    `Wij verzoeken u vriendelijk dit bedrag vóór ${fmt.date(invoice.due_date)} over te maken naar:\n` +
    `IBAN: ${settings?.iban || 'NL00BANK0123456789'}\n` +
    `BIC: ${settings?.bic || ''}\n` +
    `Onder vermelding van: ${invoice.invoice_number}\n\n` +
    `Met vriendelijke groet,\n` +
    `${companyName}`
  )

  return `mailto:${recipient}?subject=${subject}&body=${body}`
}

/**
 * Direct dispatch via Resend REST API
 */
export async function sendInvoiceViaResend(
  invoice: Invoice,
  settings?: BusinessSettings
): Promise<{ ok: boolean; message: string }> {
  const apiKey = getResendKey()
  if (!apiKey) {
    return { ok: false, message: 'Geen Resend API sleutel geconfigureerd.' }
  }

  const recipient = invoice.client?.email
  if (!recipient) {
    return { ok: false, message: 'Deze klant heeft geen e-mailadres geregistreerd.' }
  }

  const sender = getResendSender()
  const companyName = settings?.company_name || 'AliBirds Studio'

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
      <div style="padding: 24px; border-bottom: 2px solid #e2e8f0;">
        <h2 style="margin: 0; color: ${settings?.accent_color || '#4f46e5'};">${companyName}</h2>
        <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Nieuwe factuur gereed</p>
      </div>
      <div style="padding: 24px;">
        <p>Beste ${invoice.client?.contact_person || invoice.client?.name || 'klant'},</p>
        <p>Hierbij ontvangt u factuur <strong>${invoice.invoice_number}</strong>.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Factuurnummer:</td>
              <td style="text-align: right; font-weight: bold;">${invoice.invoice_number}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Factuurdatum:</td>
              <td style="text-align: right;">${fmt.date(invoice.issue_date)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Vervaldatum:</td>
              <td style="text-align: right;">${fmt.date(invoice.due_date)}</td>
            </tr>
            <tr style="border-top: 1px solid #cbd5e1;">
              <td style="padding-top: 8px; font-weight: bold;">Totaalbedrag incl. btw:</td>
              <td style="padding-top: 8px; text-align: right; font-weight: bold; font-size: 16px; color: ${settings?.accent_color || '#4f46e5'};">
                ${fmt.currency(invoice.total_incl)}
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
          KvK: ${settings?.kvk_number || '12345678'} | BTW: ${settings?.vat_number || 'NL123456789B01'}
        </p>
      </div>
    </div>
  `

  try {
    const res = await axios.post(
      'https://api.resend.com/emails',
      {
        from: `${companyName} <${sender}>`,
        to: [recipient],
        subject: `Factuur ${invoice.invoice_number} van ${companyName}`,
        html: htmlBody,
      },
      {
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
    return {
      ok: false,
      message: err.response?.data?.message || err.message || 'Fout bij verzenden via Resend.',
    }
  }
}
