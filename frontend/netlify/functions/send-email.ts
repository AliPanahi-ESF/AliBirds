/**
 * Netlify Serverless Function: Send Email via Resend API
 *
 * Security:
 * - Requires Authorization: Bearer <token> to prevent open relay abuse.
 * - API key is loaded strictly from Netlify server environment (RESEND_API_KEY).
 * - Enforces verified server-side sender to prevent phishing spoofing.
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  // 1. Verify Authentication (Prevent open email relay)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ ok: false, message: 'Niet geautoriseerd: Bearer token vereist.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const token = authHeader.slice(7).trim()
  if (!token) {
    return new Response(JSON.stringify({ ok: false, message: 'Ongeldig autorisatietoken.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // Validate token against Supabase if configured
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseAnon) {
    try {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnon,
        },
      })
      if (!userRes.ok) {
        return new Response(JSON.stringify({ ok: false, message: 'Autorisatie mislukt: ongeldige sessie.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }
    } catch (authErr) {
      console.warn('Could not verify Supabase token via network:', authErr)
      // Allow through only if token has valid JWT structure (header.payload.signature)
      if (token.split('.').length !== 3) {
        return new Response(JSON.stringify({ ok: false, message: 'Ongeldig tokenformaat.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }
    }
  }

  try {
    const body = await req.json()
    const { to, subject, html, attachments, replyTo } = body

    if (!to || (Array.isArray(to) ? to.length === 0 : !to)) {
      return new Response(JSON.stringify({ ok: false, message: 'Geen e-mailadres voor ontvanger opgegeven.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // API key strictly from server environment variables
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      console.error('RESEND_API_KEY is niet geconfigureerd op de Netlify server.')
      return new Response(JSON.stringify({
        ok: false,
        message: 'E-mailservice is nog niet geconfigureerd. Voeg RESEND_API_KEY toe in de Netlify Site Configuration.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Enforce verified server-side sender
    const resendSender = process.env.RESEND_FROM_EMAIL || 'AliBirds <onboarding@resend.dev>'

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
          message: resendData.message || 'Resend kon de e-mail niet verzenden.',
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
        message: err.message || 'Interne serverfout bij verzenden van e-mail.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  }
}
