import { Client } from './types'

async function decompressChunk(rawDeflate: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined') return null
  try {
    const ds = new DecompressionStream('deflate-raw')
    const writer = ds.writable.getWriter()
    const readPromise = new Response(ds.readable).arrayBuffer().catch(() => null)
    await writer.write(rawDeflate).catch(() => {})
    await writer.close().catch(() => {})
    const res = await readPromise
    if (res) {
      const bytes = new Uint8Array(res)
      let str = ''
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i])
      }
      return str
    }
  } catch {
    // ignore decompression errors
  }
  return null
}

async function tryDecompress(raw: Uint8Array): Promise<string | null> {
  if (raw.length > 6) {
    const withoutHeader = raw.subarray(2, raw.length - 4)
    const res = await decompressChunk(withoutHeader)
    if (res) return res
  }
  const resRaw = await decompressChunk(raw)
  if (resRaw) return resRaw

  if (typeof DecompressionStream !== 'undefined') {
    try {
      const ds = new DecompressionStream('deflate')
      const writer = ds.writable.getWriter()
      const readPromise = new Response(ds.readable).arrayBuffer().catch(() => null)
      await writer.write(raw).catch(() => {})
      await writer.close().catch(() => {})
      const res = await readPromise
      if (res) {
        const bytes = new Uint8Array(res)
        let str = ''
        for (let i = 0; i < bytes.length; i++) {
          str += String.fromCharCode(bytes[i])
        }
        return str
      }
    } catch {}
  }
  return null
}

function cleanPdfString(s: string): string {
  // Strip null bytes (common in UTF-16BE streams)
  let clean = s.replace(/\x00/g, '')
  // Unescape standard PDF escapes
  clean = clean.replace(/\\([()\\])/g, '$1')
  clean = clean.replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  return clean.trim()
}

/**
 * Loads PDF.js dynamically from CDN if standard stream extraction yields no text.
 */
async function extractTextWithPdfJs(arrayBuffer: ArrayBuffer): Promise<string[]> {
  try {
    if (!(window as any).pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load PDF.js'))
        document.head.appendChild(script)
      })
    }
    const pdfjsLib = (window as any).pdfjsLib
    if (!pdfjsLib) return []
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    const collected: string[] = []

    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 5); pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      for (const item of textContent.items) {
        if (item.str && item.str.trim()) {
          collected.push(item.str.trim())
        }
      }
    }
    return collected
  } catch (err) {
    console.warn('PDF.js fallback error:', err)
    return []
  }
}

export interface ExtractedInvoiceData {
  invoiceNumber: string
  counterparty: string
  matchedClientId: string
  matchedClientName: string
  iban: string
  date: string
  amountIncl: number
  amountExcl: number
  vatAmount: number
  vatRate: string
  reference: string
  rawStrings: string[]
}

export async function parsePdfInvoice(
  file: File,
  existingClients: Client[] = []
): Promise<ExtractedInvoiceData> {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  // Convert arrayBuffer to latin-1 string for stream boundary scanning
  let latinStr = ''
  // Process in chunks to avoid call stack overflow on large buffers
  const chunkSize = 32768
  for (let i = 0; i < bytes.length; i += chunkSize) {
    latinStr += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)))
  }

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let m: RegExpExecArray | null
  const allStrings: string[] = []
  let fullAccumulatedText = ''

  while ((m = streamRegex.exec(latinStr)) !== null) {
    const rawMatch = m[1]
    const rawBytes = new Uint8Array(rawMatch.length)
    for (let b = 0; b < rawMatch.length; b++) {
      rawBytes[b] = rawMatch.charCodeAt(b)
    }

    const decompStr = await tryDecompress(rawBytes)
    const targetText = decompStr || rawMatch
    if (decompStr) {
      fullAccumulatedText += ' ' + decompStr.replace(/\x00/g, ' ')
    }

    // Extract text in TJ / Tj operators
    const matches = targetText.match(/\((.*?)\)\s*T[jJ]|\[(.*?)\]\s*TJ/g)
    if (matches) {
      for (const match of matches) {
        const inParens = match.match(/\((.*?)\)/g)
        if (inParens) {
          for (const p of inParens) {
            const clean = cleanPdfString(p.slice(1, -1))
            if (clean) allStrings.push(clean)
          }
        }
      }
    }
  }

  // Fallback to literal parenthesized strings if no stream operators found
  if (allStrings.length === 0) {
    const literalMatches = latinStr.match(/\(([^()]{3,100})\)/g)
    if (literalMatches) {
      for (const lm of literalMatches) {
        const clean = cleanPdfString(lm.slice(1, -1))
        if (clean && !clean.startsWith('%') && !clean.includes('Font') && !clean.includes('Filter')) {
          allStrings.push(clean)
        }
      }
    }
  }

  // Fallback to PDF.js if strings are still empty
  if (allStrings.length === 0) {
    const pdfJsStrings = await extractTextWithPdfJs(arrayBuffer)
    if (pdfJsStrings.length > 0) {
      allStrings.push(...pdfJsStrings)
      fullAccumulatedText += ' ' + pdfJsStrings.join(' ')
    }
  }

  // Now run extraction heuristics
  let counterparty = ''
  let iban = ''
  let date = ''
  let amount = 0
  let reference = ''
  let invoiceNumber = ''

  for (let i = 0; i < allStrings.length; i++) {
    const s = allStrings[i]

    // IBAN (ignore own Bunq account if present)
    const ibanM = s.match(/([A-Z]{2}\d{2}\s*[A-Z]{4}\s*[\d\s]{7,14})/i)
    if (ibanM && !iban && !s.includes('NL92 BUNQ 2192 2826 05') && !s.includes('NL92BUNQ2192282605')) {
      iban = ibanM[1].replace(/\s+/g, '').toUpperCase()
    }

    // Date YYYY-MM-DD
    const dateM = s.match(/\b(202\d-[01]\d-[0-3]\d)\b/)
    if (dateM && !date) {
      date = dateM[1]
    }
    // Date DD-MM-YYYY or DD.MM.YYYY
    const dateAlt = s.match(/\b([0-3]\d)[-/.]([01]\d)[-/.]((?:202\d))\b/)
    if (dateAlt && !date) {
      date = `${dateAlt[3]}-${dateAlt[2]}-${dateAlt[1]}`
    }

    // Amount: e.g. "+ ¬ 1.450,00" or "- ¬ 602,84" or "€ 200,00" or "1.450,00"
    const amountM = s.match(/[+\-−]?\s*[€¬EUReur]*\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/)
    if (amountM && !amount) {
      const clean = amountM[1].replace(/\./g, '').replace(',', '.')
      const val = parseFloat(clean)
      if (!isNaN(val) && val > 0 && val < 1000000) {
        amount = val
      }
    }

    // Reference from receipt or invoice
    if (
      s.toLowerCase().startsWith('reference') ||
      s.startsWith('RF') ||
      s.match(/^Factuur\b/i) ||
      s.match(/^Invoice\b/i) ||
      s.match(/Rent\s+/i)
    ) {
      if (!reference) {
        reference = s.replace(/^reference\s*/i, '').replace(/\.$/, '').trim()
      }
    }

    // Counterparty after "Counterparty" or "Tegenpartij" header (bunq format)
    if (s === 'Counterparty' || s === 'Tegenpartij') {
      for (let j = i + 1; j < allStrings.length; j++) {
        const next = allStrings[j]
        if (
          !next.match(/\b202\d-[01]\d-[0-3]\d\b/) &&
          !next.startsWith('NL') &&
          !next.includes('Date') &&
          !next.includes('Description') &&
          !next.includes('Amount') &&
          next.length > 2
        ) {
          counterparty = next
          break
        }
      }
    }

    // Standard Invoice Number patterns
    const invMatch = s.match(/(?:factuur(?:nummer|nr)?|invoice\s*(?:no|number|#)?)\s*[:.\s#]*([A-Z0-9_-]{3,20})/i)
    if (invMatch && !invoiceNumber) {
      invoiceNumber = invMatch[1].trim()
    }
  }

  // Fallbacks from fullText
  if (!date) {
    const fullDate = fullAccumulatedText.match(/\b(202\d-[01]\d-[0-3]\d)\b/)
    if (fullDate) date = fullDate[1]
  }

  // Fallback for amount if missed in token list
  if (!amount) {
    const eurMatches =
      fullAccumulatedText.match(/(?:€|EUR|eur|euro|¬)[\s:]*([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/gi) ||
      fullAccumulatedText.match(/(?:totaal|total|subtotaal)[\s:]*([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/gi)
    if (eurMatches) {
      for (const em of eurMatches) {
        const clean = em.replace(/(?:€|EUR|eur|euro|¬|totaal|total|subtotaal|[\s:])/gi, '')
        const norm = clean.includes(',') && clean.includes('.')
          ? clean.replace(/\./g, '').replace(',', '.')
          : clean.replace(',', '.')
        const val = parseFloat(norm)
        if (!isNaN(val) && val > amount && val < 1000000) {
          amount = val
        }
      }
    }
  }

  // If invoice number is still empty, use reference if available
  if (!invoiceNumber && reference) {
    invoiceNumber = reference
  }

  // If still empty, check filename
  const fname = file.name
  if (!invoiceNumber) {
    const fnMatch =
      fname.match(/(?:factuur[_-]?|inv[_-]?|invoice[_-]?)?([0-9]{4}[-_][0-9]{3,5}|202\d{5})/i) ||
      fname.match(/(202\d[-_]\d+)/) ||
      fname.match(/\b([A-Z]{2,4}[-_]?\d{3,6})\b/i)
    if (fnMatch) invoiceNumber = fnMatch[1].replace('_', '-')
  }

  // Check client matching
  let matchedClient: Client | undefined
  if (counterparty) {
    matchedClient = existingClients.find(
      c =>
        c.name.toLowerCase().includes(counterparty.toLowerCase()) ||
        counterparty.toLowerCase().includes(c.name.toLowerCase())
    )
  }

  // Check if filename mentions a client
  if (!matchedClient) {
    for (const c of existingClients) {
      if (c.name && fname.toLowerCase().includes(c.name.toLowerCase())) {
        matchedClient = c
        if (!counterparty) counterparty = c.name
        break
      }
    }
  }

  const roundedIncl = Math.round(amount * 100) / 100
  const roundedExcl = Math.round((roundedIncl / 1.21) * 100) / 100
  const calculatedVat = Math.round((roundedIncl - roundedExcl) * 100) / 100

  return {
    invoiceNumber:
      invoiceNumber || `FACT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    counterparty,
    matchedClientId: matchedClient ? matchedClient.id : counterparty ? 'NEW' : '',
    matchedClientName: matchedClient ? matchedClient.name : counterparty,
    iban,
    date: date || new Date().toISOString().slice(0, 10),
    amountIncl: roundedIncl,
    amountExcl: roundedExcl,
    vatAmount: calculatedVat,
    vatRate: '21',
    reference: reference || counterparty || fname.replace(/\.pdf$/i, ''),
    rawStrings: allStrings,
  }
}
