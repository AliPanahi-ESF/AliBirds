/**
 * AliBirds Native Client-Side MT940 (.sta) Bank Statement Parser
 * Supports Dutch banks: bunq, ING, Rabobank, ABN AMRO, Knab.
 * Parses statement lines (:61:) and remittance details (:86:).
 */
import { BankTransaction } from './types'

export interface ParsedBankStatement {
  accountIban: string
  currency: string
  transactions: Partial<BankTransaction>[]
}

/**
 * Generate a deterministic hash for deduplication
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

/**
 * Parse an MT940 / .sta text content directly in browser
 */
export function parseMT940(content: string): ParsedBankStatement {
  const lines = content.split(/\r?\n/)
  let accountIban = ''
  let currency = 'EUR'
  const transactions: Partial<BankTransaction>[] = []
  let currentTx: Partial<BankTransaction> | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // :25: Account identification (e.g. :25:NL92BUNQ2192282605 EUR or :25:123456789)
    if (line.startsWith(':25:')) {
      const rawAcc = line.substring(4).trim()
      const parts = rawAcc.split(/\s+/)
      accountIban = parts[0] || ''
      if (parts[1]) currency = parts[1]
    }

    // :61: Statement line
    // Format: :61:YYMMDD[MMDD](C|D|RC|RD)[Letter]Amount,Cent[NTRF...][Ref]
    else if (line.startsWith(':61:')) {
      if (currentTx) {
        transactions.push(currentTx)
      }

      const raw = line.substring(4).trim()
      // Capture groups:
      // 1: YYMMDD date (6 digits)
      // 2: optional entry date (4 digits)
      // 3: C/D/RC/RD
      // 4: optional funds code (1 letter)
      // 5: Amount (digits + comma + digits)
      // 6: Transaction code (4 chars, e.g. NTRF, NMSC)
      // 7: Remaining reference
      const m = raw.match(/^(\d{6})(?:\d{4})?([CRD]{1,2})([A-Z])?(\d+(?:,\d*)?)(?:[A-Z0-9]{4})?(.*)/)

      if (m) {
        const yymmdd = m[1]
        const year = 2000 + parseInt(yymmdd.slice(0, 2), 10)
        const month = yymmdd.slice(2, 4)
        const day = yymmdd.slice(4, 6)
        const dateStr = `${year}-${month}-${day}`

        const typeChar = m[2]
        const txType: 'CREDIT' | 'DEBIT' = typeChar.includes('C') ? 'CREDIT' : 'DEBIT'
        const amountStr = m[4].replace(',', '.')
        const amountNum = parseFloat(amountStr) || 0

        const rawRef = m[5] ? m[5].trim() : ''

        currentTx = {
          id: `tx-${Date.now()}-${transactions.length + 1}`,
          transaction_date: dateStr,
          value_date: dateStr,
          type: txType,
          transaction_type: txType,
          amount: amountNum,
          currency: currency || 'EUR',
          description: '',
          counterpart_iban: '',
          contra_account_iban: '',
          counterpart_name: '',
          contra_account_name: '',
          remittance_reference: rawRef,
          raw_reference: rawRef,
          raw_hash: simpleHash(`${dateStr}-${txType}-${amountNum}-${line}`),
          reconciliation_status: 'UNMATCHED',
        }
      }
    }

    // :86: Information to Account Owner (Remittance / Counterparty)
    else if (line.startsWith(':86:')) {
      if (currentTx) {
        let desc = line.substring(4).trim()

        // Read continuation lines until next SWIFT tag (starting with : or -)
        let j = i + 1
        while (j < lines.length && !lines[j].startsWith(':') && lines[j].trim() !== '-') {
          const next = lines[j].trim()
          if (next) desc += ' ' + next
          j++
        }
        i = j - 1

        currentTx.description = desc

        // 1. Check bunq/Dutch structured tags: /IBAN/ /NAME/ /REMI/ /CSID/ /EREF/ /TRTP/
        const ibanMatch = desc.match(/\/IBAN\/([A-Z0-9]+)/i)
        if (ibanMatch) {
          const iban = ibanMatch[1].trim()
          currentTx.contra_account_iban = iban
          currentTx.counterpart_iban = iban
        }

        const nameMatch = desc.match(/\/NAME\/([^\/]+)/i)
        if (nameMatch) {
          const name = nameMatch[1].trim()
          currentTx.contra_account_name = name
          currentTx.counterpart_name = name
        }

        const remiMatch = desc.match(/\/REMI\/([^\/]+)/i)
        if (remiMatch) {
          const rem = remiMatch[1].trim()
          if (rem) {
            currentTx.raw_reference = rem
            currentTx.remittance_reference = rem
          }
        }

        // 2. ING structured format: >20... >32... /TRTP/
        if (!currentTx.counterpart_name) {
          const ingNameMatch = desc.match(/>32([^\/>]+)/)
          if (ingNameMatch) {
            const name = ingNameMatch[1].trim()
            currentTx.contra_account_name = name
            currentTx.counterpart_name = name
          }
        }
        if (!currentTx.counterpart_iban) {
          const ingIbanMatch = desc.match(/>30([A-Z0-9]+)/)
          if (ingIbanMatch) {
            const iban = ingIbanMatch[1].trim()
            currentTx.contra_account_iban = iban
            currentTx.counterpart_iban = iban
          }
        }

        // 3. Fallback: Detect IBAN anywhere in text
        if (!currentTx.counterpart_iban) {
          const generalIbanMatch = desc.match(/([A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,10})/i)
          if (generalIbanMatch) {
            const iban = generalIbanMatch[1].toUpperCase()
            currentTx.contra_account_iban = iban
            currentTx.counterpart_iban = iban
          }
        }

        // 4. Fallback: If no counterpart name but remittance reference is empty, use desc
        if (!currentTx.remittance_reference) {
          currentTx.remittance_reference = desc
          currentTx.raw_reference = desc
        }

        // Recompute unique hash with description
        currentTx.raw_hash = simpleHash(
          `${currentTx.value_date}-${currentTx.transaction_type}-${currentTx.amount}-${currentTx.counterpart_iban}-${currentTx.counterpart_name}-${currentTx.remittance_reference}`
        )
      }
    }
  }

  if (currentTx) {
    transactions.push(currentTx)
  }

  return {
    accountIban,
    currency,
    transactions,
  }
}

/**
 * Smart Reconciliation: Matches transactions against outstanding invoices
 */
export function autoMatchTransactions(
  transactions: Partial<BankTransaction>[],
  invoices: any[]
): {
  matched: number
  results: { tx: Partial<BankTransaction>; invoiceId?: string; score: number }[]
} {
  let matchCount = 0

  const results = transactions.map(tx => {
    // Only match incoming payments (CREDIT)
    if (tx.transaction_type !== 'CREDIT' || tx.reconciliation_status === 'MATCHED') {
      return { tx, score: 0 }
    }

    const txText = `${tx.description || ''} ${tx.raw_reference || ''}`.toLowerCase()

    let bestInvoice: any = null
    let bestScore = 0

    for (const inv of invoices) {
      // 1. Exact Invoice Number in remittance (e.g. "2026-0001")
      const invNum = (inv.invoice_number || '').toLowerCase()
      if (invNum && txText.includes(invNum)) {
        bestInvoice = inv
        bestScore = 100
        break
      }

      // 2. Exact amount match + unpaid invoice
      const invTotal = Number(inv.total_incl ?? inv.total_incl_vat) || 0
      if (Math.abs(invTotal - (tx.amount || 0)) < 0.01) {
        // Also check if client name matches counterparty
        const clientName = (inv.client?.name || '').toLowerCase()
        const contraName = (tx.contra_account_name || '').toLowerCase()

        if (clientName && contraName && (contraName.includes(clientName) || clientName.includes(contraName))) {
          bestInvoice = inv
          bestScore = 95
          break
        } else if (!bestInvoice) {
          bestInvoice = inv
          bestScore = 75
        }
      }
    }

    if (bestInvoice && bestScore >= 75) {
      matchCount++
      return {
        tx: {
          ...tx,
          reconciliation_status: 'MATCHED',
          matched_invoice_id: bestInvoice.id,
          match_score: bestScore,
        },
        invoiceId: bestInvoice.id,
        score: bestScore,
      }
    }

    return { tx, score: 0 }
  })

  return { matched: matchCount, results }
}
