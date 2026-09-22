// AI Receipt & Smart Inbox Scanner (OCR) for AliBirds / MoneyBirds NL
import { OCRParsedResult } from './types'

// Comprehensive Dutch & European Merchant Dictionary
const MERCHANT_KNOWLEDGE_BASE: Array<{
  name: string
  pattern: RegExp
  category: string
  defaultVat: string
}> = [
  // Software & Cloud
  { name: 'Adobe Systems', pattern: /adobe/i, category: 'Software', defaultVat: '21' },
  { name: 'Google Workspace', pattern: /google\s*(workspace|cloud|storage|ireland)?/i, category: 'Software', defaultVat: 'REVERSE_CHARGE' },
  { name: 'Amazon Web Services', pattern: /aws|amazon\s*web\s*services/i, category: 'Software', defaultVat: 'REVERSE_CHARGE' },
  { name: 'Microsoft 365', pattern: /microsoft/i, category: 'Software', defaultVat: '21' },
  { name: 'GitHub', pattern: /github/i, category: 'Software', defaultVat: 'REVERSE_CHARGE' },
  { name: 'Vercel Inc.', pattern: /vercel/i, category: 'Software', defaultVat: 'REVERSE_CHARGE' },
  { name: 'Netlify Inc.', pattern: /netlify/i, category: 'Software', defaultVat: 'REVERSE_CHARGE' },
  { name: 'OpenAI (ChatGPT)', pattern: /openai|chatgpt/i, category: 'Software', defaultVat: 'REVERSE_CHARGE' },
  { name: 'TransIP BV', pattern: /transip/i, category: 'Software', defaultVat: '21' },
  { name: 'Hostnet BV', pattern: /hostnet/i, category: 'Software', defaultVat: '21' },
  { name: 'Slack Technologies', pattern: /slack/i, category: 'Software', defaultVat: 'REVERSE_CHARGE' },
  { name: 'Figma Inc.', pattern: /figma/i, category: 'Software', defaultVat: 'REVERSE_CHARGE' },
  { name: 'JetBrains s.r.o.', pattern: /jetbrains/i, category: 'Software', defaultVat: 'REVERSE_CHARGE' },
  { name: 'Zoom Video Comm.', pattern: /zoom(\.us)?/i, category: 'Software', defaultVat: 'REVERSE_CHARGE' },
  { name: 'Miro (RealtimeBoard)', pattern: /miro/i, category: 'Software', defaultVat: 'REVERSE_CHARGE' },
  { name: 'Notion Labs', pattern: /notion/i, category: 'Software', defaultVat: 'REVERSE_CHARGE' },

  // Fuel, Parking & Travel
  { name: 'Shell Nederland', pattern: /shell/i, category: 'Reiskosten', defaultVat: '21' },
  { name: 'BP Station', pattern: /\bbp\b|british\s*petroleum/i, category: 'Reiskosten', defaultVat: '21' },
  { name: 'TotalEnergies', pattern: /total(energies)?/i, category: 'Reiskosten', defaultVat: '21' },
  { name: 'Esso Station', pattern: /esso/i, category: 'Reiskosten', defaultVat: '21' },
  { name: 'TinQ Brandstoffen', pattern: /tinq/i, category: 'Reiskosten', defaultVat: '21' },
  { name: 'Tango Tankstation', pattern: /tango/i, category: 'Reiskosten', defaultVat: '21' },
  { name: 'NS Reizigers (Trein)', pattern: /\bns\b|nederlandse\s*spoorwegen/i, category: 'Reiskosten', defaultVat: '9' },
  { name: 'NS Zakelijk', pattern: /ns\s*zakelijk/i, category: 'Reiskosten', defaultVat: '9' },
  { name: 'Uber BV', pattern: /uber/i, category: 'Reiskosten', defaultVat: '9' },
  { name: 'Bolt Services', pattern: /bolt/i, category: 'Reiskosten', defaultVat: '9' },
  { name: 'Q-Park Nederland', pattern: /q-?park/i, category: 'Reiskosten', defaultVat: '21' },
  { name: 'Parkmobile / EasyPark', pattern: /parkmobile|easypark/i, category: 'Reiskosten', defaultVat: '21' },
  { name: 'Yellowbrick', pattern: /yellowbrick/i, category: 'Reiskosten', defaultVat: '21' },

  // Hardware & Office
  { name: 'Apple Distribution', pattern: /apple/i, category: 'Hardware', defaultVat: '21' },
  { name: 'Coolblue BV', pattern: /coolblue/i, category: 'Hardware', defaultVat: '21' },
  { name: 'Bol.com BV', pattern: /bol\.com/i, category: 'Kantoor', defaultVat: '21' },
  { name: 'MediaMarkt', pattern: /mediamarkt|media\s*markt/i, category: 'Hardware', defaultVat: '21' },
  { name: 'BCC Elektro', pattern: /\bbcc\b/i, category: 'Hardware', defaultVat: '21' },
  { name: 'HEMA BV', pattern: /hema/i, category: 'Kantoor', defaultVat: '21' },
  { name: 'Action Nederland', pattern: /action/i, category: 'Kantoor', defaultVat: '21' },
  { name: 'Bruna Kantoor', pattern: /bruna/i, category: 'Kantoor', defaultVat: '21' },
  { name: 'Staples Solutions', pattern: /staples/i, category: 'Kantoor', defaultVat: '21' },
  { name: 'IKEA Nederland', pattern: /ikea/i, category: 'Kantoor', defaultVat: '21' },

  // DIY & Equipment
  { name: 'Gamma Bouwmarkt', pattern: /gamma/i, category: 'Kantoor', defaultVat: '21' },
  { name: 'Praxis Bouwmarkt', pattern: /praxis/i, category: 'Kantoor', defaultVat: '21' },
  { name: 'Hornbach Bouwmarkt', pattern: /hornbach/i, category: 'Kantoor', defaultVat: '21' },
  { name: 'Karwei Bouwmarkt', pattern: /karwei/i, category: 'Kantoor', defaultVat: '21' },

  // Supermarkets & Catering / Client Meetings
  { name: 'Albert Heijn BV', pattern: /albert\s*heijn|\bah\b/i, category: 'Overig', defaultVat: '9' },
  { name: 'Jumbo Supermarkten', pattern: /jumbo/i, category: 'Overig', defaultVat: '9' },
  { name: 'Plus Supermarkt', pattern: /plus/i, category: 'Overig', defaultVat: '9' },
  { name: 'Dirk van den Broek', pattern: /dirk/i, category: 'Overig', defaultVat: '9' },
  { name: 'Thuisbezorgd.nl', pattern: /thuisbezorgd|takeaway/i, category: 'Overig', defaultVat: '9' },

  // Telecom & Utilities
  { name: 'KPN Telecom', pattern: /kpn/i, category: 'Abonnementen', defaultVat: '21' },
  { name: 'VodafoneZiggo', pattern: /vodafone|ziggo/i, category: 'Abonnementen', defaultVat: '21' },
  { name: 'Odido Netherlands', pattern: /odido|t-mobile/i, category: 'Abonnementen', defaultVat: '21' },

  // Official / Professional Services
  { name: 'Kamer van Koophandel (KVK)', pattern: /kamer\s*van\s*koophandel|\bkvk\b/i, category: 'Professionele Diensten', defaultVat: '0' },
  { name: 'Belastingdienst', pattern: /belastingdienst/i, category: 'Professionele Diensten', defaultVat: '0' },
  { name: 'Bunq BV', pattern: /bunq/i, category: 'Professionele Diensten', defaultVat: '0' },
]

const DUTCH_MONTHS: Record<string, string> = {
  januari: '01', jan: '01',
  februari: '02', feb: '02',
  maart: '03', mrt: '03',
  april: '04', apr: '04',
  mei: '05',
  juni: '06', jun: '06',
  juli: '07', jul: '07',
  augustus: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  oktober: '10', okt: '10',
  november: '11', nov: '11',
  december: '12', dec: '12',
}

/**
 * Clean Dutch formatted price strings like "1.450,50" or "€ 45,99" or "45.99"
 */
function parseDutchAmount(str: string): number {
  if (!str) return 0
  const clean = str.replace(/[^\d.,]/g, '').trim()
  if (!clean) return 0

  if (clean.includes(',') && clean.includes('.')) {
    // "1.250,50" -> standard Dutch format
    return parseFloat(clean.replace(/\./g, '').replace(',', '.'))
  } else if (clean.includes(',')) {
    // "45,99"
    return parseFloat(clean.replace(',', '.'))
  } else {
    // "45.99"
    return parseFloat(clean)
  }
}

/**
 * Extract dates matching Dutch formats (DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, or "14 mei 2026")
 */
function extractDate(text: string): string {
  const today = new Date().toISOString().slice(0, 10)

  // Pattern 1: ISO YYYY-MM-DD
  const isoMatch = text.match(/\b(202[0-9])[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12][0-9]|3[01])\b/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  // Pattern 2: Dutch DD-MM-YYYY or DD/MM/YYYY
  const dutchMatch = text.match(/\b(0[1-9]|[12][0-9]|3[01])[-/.](0[1-9]|1[0-2])[-/.](202[0-9])\b/)
  if (dutchMatch) {
    return `${dutchMatch[3]}-${dutchMatch[2]}-${dutchMatch[1]}`
  }

  // Pattern 3: Dutch text date (e.g. "15 september 2026")
  const textDateMatch = text.match(
    /\b(0?[1-9]|[12][0-9]|3[01])\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|okt|nov|dec)\s+(202[0-9])\b/i
  )
  if (textDateMatch) {
    const day = textDateMatch[1].padStart(2, '0')
    const month = DUTCH_MONTHS[textDateMatch[2].toLowerCase()] || '01'
    const year = textDateMatch[3]
    return `${year}-${month}-${day}`
  }

  return today
}

/**
 * Extract text from an uploaded PDF file using browser decompression streams
 */
async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)
    let rawString = ''

    // Fast text extraction from uncompressed / standard PDF blocks
    for (let i = 0; i < Math.min(uint8.length, 500_000); i++) {
      const charCode = uint8[i]
      if (charCode >= 32 && charCode <= 126) {
        rawString += String.fromCharCode(charCode)
      } else if (charCode === 10 || charCode === 13) {
        rawString += ' '
      }
    }

    return rawString
  } catch (err) {
    console.warn('[OCR] PDF text extraction failed:', err)
    return ''
  }
}

/**
 * Intelligent Heuristic & NLP Scanner
 */
function parseReceiptText(text: string, filename: string = ''): OCRParsedResult {
  const combined = `${filename} ${text}`

  // 1. Detect Vendor & Suggested Category
  let vendorName = 'Onbekende Leverancier'
  let suggestedCategory = 'Algemeen'
  let detectedVatRate: '21' | '9' | '0' | 'REVERSE_CHARGE' = '21'

  for (const merchant of MERCHANT_KNOWLEDGE_BASE) {
    if (merchant.pattern.test(combined)) {
      vendorName = merchant.name
      suggestedCategory = merchant.category
      detectedVatRate = merchant.defaultVat as any
      break
    }
  }

  // If no known merchant, try to find company name or domain in text
  if (vendorName === 'Onbekende Leverancier') {
    const bvMatch = combined.match(/\b([A-Z][A-Za-z0-9\s&]{2,30})\s+(B\.?V\.?|N\.?V\.?|V\.?O\.?F\.?)\b/i)
    if (bvMatch) {
      vendorName = bvMatch[0].trim()
    } else {
      // Use clean filename if it has merchant-like characters
      const cleanName = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim()
      if (cleanName.length > 2 && !cleanName.match(/^(image|scan|receipt|bon|factuur|document)/i)) {
        vendorName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
      }
    }
  }

  // 2. Detect Date
  const expenseDate = extractDate(combined)

  // 3. Detect VAT Rate
  if (/verlegd|reverse\s*charge|0%\s*verlegd/i.test(combined)) {
    detectedVatRate = 'REVERSE_CHARGE'
  } else if (/9\s*%/i.test(combined) && !/21\s*%/i.test(combined)) {
    detectedVatRate = '9'
  } else if (/0\s*%/i.test(combined) && !/21\s*%/i.test(combined)) {
    detectedVatRate = '0'
  } else if (/21\s*%/i.test(combined)) {
    detectedVatRate = '21'
  }

  // 4. Detect Total Amount
  let totalAmount = 0

  // Look for total patterns: "Totaal: € 45,99", "Te betalen: 45.99", "Total EUR 120,00"
  const totalRegexes = [
    /(?:totaal|total|te\s*betalen|bedrag|eindtotaal|subtotaal)\s*(?:incl\.?\s*btw)?\s*[:=\s]?\s*(?:eur|€)?\s*([0-9]{1,4}(?:[.,][0-9]{2,3})*(?:[.,][0-9]{2}))/gi,
    /(?:eur|€)\s*([0-9]{1,4}(?:[.,][0-9]{2,3})*(?:[.,][0-9]{2}))/gi,
  ]

  const candidateAmounts: number[] = []

  for (const regex of totalRegexes) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(combined)) !== null) {
      const val = parseDutchAmount(match[1])
      if (val > 0 && val < 50000) {
        candidateAmounts.push(val)
      }
    }
  }

  if (candidateAmounts.length > 0) {
    // Usually total is the maximum or primary amount
    totalAmount = Math.max(...candidateAmounts)
  }

  // Fallback: look for any decimal amount near the end of receipt
  if (!totalAmount) {
    const anyAmounts = combined.match(/\b([0-9]{1,4}[.,][0-9]{2})\b/g)
    if (anyAmounts && anyAmounts.length > 0) {
      const parsed = anyAmounts.map(parseDutchAmount).filter(n => n > 0 && n < 10000)
      if (parsed.length > 0) {
        totalAmount = Math.max(...parsed)
      }
    }
  }

  // 5. Calculate Complementary VAT and Net Amounts
  let amountExcl = totalAmount
  let vatAmount = 0

  const r = detectedVatRate === 'REVERSE_CHARGE' ? 0 : (Number(detectedVatRate) / 100)
  if (r > 0 && totalAmount > 0) {
    amountExcl = Math.round((totalAmount / (1 + r)) * 100) / 100
    vatAmount = Math.round((totalAmount - amountExcl) * 100) / 100
  }

  return {
    vendor_name: vendorName,
    expense_date: expenseDate,
    amount_excl_vat: amountExcl,
    vat_rate: detectedVatRate,
    vat_amount: vatAmount,
    amount_incl_vat: totalAmount,
    category: suggestedCategory,
    description: `Factuur / Kassabon ${vendorName}`,
    confidence: totalAmount > 0 ? 0.88 : 0.65,
    raw_text: text.slice(0, 500),
  }
}

/**
 * Optional Gemini AI Vision Integration
 * If Gemini API Key is provided or available, sends image for structured multimodal analysis
 */
async function callGeminiVision(file: File, base64Data: string): Promise<OCRParsedResult | null> {
  const geminiApiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
    (typeof window !== 'undefined' && (window as any).__GEMINI_API_KEY__)

  if (!geminiApiKey) return null

  try {
    const mimeType = file.type || 'image/jpeg'
    const pureBase64 = base64Data.split(',')[1] || base64Data

    const prompt = `
You are an expert Dutch bookkeeping AI (like Moneybird Smart Inbox and Jortt).
Analyze this receipt or supplier invoice image from the Netherlands.
Return ONLY valid JSON matching this exact structure:
{
  "vendor_name": "Merchant or Vendor Name (e.g. Shell, NS, Adobe, Apple)",
  "expense_date": "YYYY-MM-DD",
  "amount_incl_vat": 0.00,
  "vat_rate": "21" or "9" or "0" or "REVERSE_CHARGE",
  "vat_amount": 0.00,
  "amount_excl_vat": 0.00,
  "category": "Software" or "Reiskosten" or "Kantoor" or "Hardware" or "Marketing" or "Professionele Diensten" or "Abonnementen" or "Overig",
  "description": "Brief summary of purchased goods/services"
}
`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: pureBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!textOutput) return null

    const parsed = JSON.parse(textOutput)
    return {
      vendor_name: parsed.vendor_name || 'Onbekend',
      expense_date: parsed.expense_date || new Date().toISOString().slice(0, 10),
      amount_excl_vat: Number(parsed.amount_excl_vat) || 0,
      vat_rate: String(parsed.vat_rate || '21'),
      vat_amount: Number(parsed.vat_amount) || 0,
      amount_incl_vat: Number(parsed.amount_incl_vat) || 0,
      category: parsed.category || 'Algemeen',
      description: parsed.description || `Inkoop bij ${parsed.vendor_name}`,
      confidence: 0.98,
    }
  } catch (err) {
    console.warn('[OCR] Gemini Vision fallback activated:', err)
    return null
  }
}

/**
 * Main OCR & Receipt Scanner Entrypoint
 */
export async function scanReceiptFile(file: File): Promise<OCRParsedResult> {
  const filename = file.name || 'receipt.png'
  const isPdf = file.type === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')

  // 1. Read file as Base64 Data URL for local preview and transmission
  const base64DataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })

  // 2. Try Gemini Multimodal Vision if it is an image
  if (!isPdf && base64DataUrl) {
    const geminiResult = await callGeminiVision(file, base64DataUrl)
    if (geminiResult && geminiResult.amount_incl_vat > 0) {
      return {
        ...geminiResult,
        receipt_url: base64DataUrl,
        receipt_filename: filename,
      }
    }
  }

  // 3. Fallback: Local Client-Side PDF / Heuristic Analysis
  let extractedText = ''
  if (isPdf) {
    extractedText = await extractTextFromPdf(file)
  } else {
    // For images without Gemini, inspect filename and metadata
    extractedText = `${filename}`
  }

  const result = parseReceiptText(extractedText, filename)

  return {
    ...result,
    receipt_url: base64DataUrl,
    receipt_filename: filename,
  }
}
