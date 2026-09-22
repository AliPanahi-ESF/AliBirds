/**
 * Netlify Serverless Function: Send Email via Resend API
 * Solves browser CORS restrictions by executing server-side on Node.js.
 *
 * Security:
 * - API key is loaded exclusively from Netlify environment variables (RESEND_API_KEY).
 * - The client never sends or controls the API key.
 * - CORS is restricted to known application origins.
 */

const ALLOWED_ORIGINS = [
  'https://alibirds.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173',
]

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get('Origin') || ''
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
}

export default async (req: Request) => {
  const corsOrigin = getCorsOrigin(req)
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    // FIXED: Parse the request body — previously missing, causing a ReferenceError crash on every call
    const body = await req.json()
    const { to, from, subject, html, attachments, apiKey, replyTo } = body

    if (!to || (Array.isArray(to) ? to.length === 0 : !to)) {
      return new Response(JSON.stringify({ ok: false, message: 'Geen e-mailadres voor ontvanger opgegeven.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // API key: Netlify server environment variable has priority; falls back to key saved in App Settings
    const resendKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || (typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : null)
    if (!resendKey) {
      console.error('RESEND_API_KEY is niet geconfigureerd op de server en ontbreekt in het verzoek.')
      return new Response(JSON.stringify({
        ok: false,
        message: 'E-mailservice is nog niet geconfigureerd. Voer uw Resend API-sleutel in bij Instellingen > E-mail of voeg RESEND_API_KEY toe in Netlify.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const resendSender = from || process.env.RESEND_FROM_EMAIL || process.env.VITE_RESEND_FROM_EMAIL || 'AliBirds <onboarding@resend.dev>'

    const emailPayload: any = {
      from: resendSender,
      to: Array.isArray(to) ? to : [to],
      subject: subject || 'Factuur van AliBirds',
      html: html || '<p>Hierbij ontvangt u uw factuur.</p>',
    }

    if (replyTo) {
      emailPayload.reply_to = replyTo
    }

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      emailPayload.attachments = attachments
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      const isTestRestriction =
        resendRes.status === 403 &&
        typeof resendData.message === 'string' &&
        resendData.message.includes('only send testing emails to your own email address')

      return new Response(
        JSON.stringify({
          ok: false,
          isResendTestingRestriction: isTestRestriction,
          message: resendData.message || 'Resend failed to dispatch email.',
        }),
        {
          status: resendRes.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        data: resendData,
        message: 'Factuur succesvol verzonden via Resend!',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  } catch (err: any) {
    console.error('send-email function error:', err)
    return new Response(
      JSON.stringify({
        ok: false,
        message: err.message || 'Internal server error while sending email.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  }
}
