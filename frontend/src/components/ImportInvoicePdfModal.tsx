import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { X, Upload, FileText, Check, AlertCircle, Building2, Calendar, Eye } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { invoicesApi, clientsApi, bankApi } from '@/lib/api'
import { Client } from '@/lib/types'

interface Props {
  clients: Client[]
  onClose: () => void
}

export default function ImportInvoicePdfModal({ clients, onClose }: Props) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [clientId, setClientId] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [issueDate, setIssueDate] = useState(today)
  const [dueDate, setDueDate] = useState(today)
  const [amountExcl, setAmountExcl] = useState<number>(0)
  const [vatRate, setVatRate] = useState<string>('21')
  const [vatAmount, setVatAmount] = useState<number>(0)
  const [amountIncl, setAmountIncl] = useState<number>(0)
  const [status, setStatus] = useState<'PAID' | 'SENT'>('PAID')
  const [description, setDescription] = useState('Historische factuur (PDF import)')

  const recalculateAmounts = (excl: number, rate: string) => {
    setAmountExcl(excl)
    setVatRate(rate)
    const multiplier = rate === 'REVERSE_CHARGE' ? 0 : Number(rate) / 100
    const vat = Math.round(excl * multiplier * 100) / 100
    const incl = Math.round((excl + vat) * 100) / 100
    setVatAmount(vat)
    setAmountIncl(incl)
  }

  const parsePdfFile = async (selectedFile: File) => {
    setIsParsing(true)
    setFile(selectedFile)

    // Convert to Data URL so it can be previewed or saved as attachment
    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPdfDataUrl(reader.result)
        }
      }
      reader.readAsDataURL(selectedFile)
    } catch {
      // ignore
    }

    try {
      // 1. Extract hints from filename (e.g. Factuur_2026-0001_Anivation.pdf)
      const fname = selectedFile.name
      const numMatch =
        fname.match(/(?:factuur[_-]?|inv[_-]?|invoice[_-]?)?([0-9]{4}[-_][0-9]{3,5}|202\d{5})/i) ||
        fname.match(/(202\d[-_]\d+)/) ||
        fname.match(/\b([A-Z]{2,4}[-_]?\d{3,6})\b/i)

      if (numMatch && numMatch[1]) {
        setInvoiceNumber(numMatch[1].replace('_', '-'))
      } else {
        setInvoiceNumber(`FACT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)
      }

      // Check if client name is in filename
      for (const cl of clients) {
        if (cl.name && fname.toLowerCase().includes(cl.name.toLowerCase())) {
          setClientId(cl.id)
          break
        }
      }

      // 2. Read file as binary to scan strings
      const buffer = await selectedFile.arrayBuffer()
      const decoder = new TextDecoder('iso-8859-1')
      let content = decoder.decode(buffer)

      // Try decompressing FlateDecode streams if available in browser
      if (typeof DecompressionStream !== 'undefined') {
        const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
        let streamMatch: RegExpExecArray | null
        let decompCount = 0
        while ((streamMatch = streamRegex.exec(content)) !== null && decompCount < 10) {
          try {
            const rawBytes = new Uint8Array(streamMatch[1].length)
            for (let b = 0; b < streamMatch[1].length; b++) {
              rawBytes[b] = streamMatch[1].charCodeAt(b)
            }
            const ds = new DecompressionStream('deflate')
            const writer = ds.writable.getWriter()
            writer.write(rawBytes)
            writer.close()
            const decompressed = await new Response(ds.readable).arrayBuffer()
            const decompText = new TextDecoder('utf-8', { fatal: false }).decode(decompressed)
            content += ' ' + decompText
            decompCount++
          } catch {
            // stream is not raw deflate or corrupted, ignore
          }
        }
      }

      // Search for invoice number in content
      const textNum = content.match(/(?:factuur(?:nummer|nr)?|invoice\s*(?:no|number)?)\s*[:.\s#]*([A-Z0-9_-]{4,18})/i)
      if (textNum && textNum[1] && textNum[1].length >= 4 && !textNum[1].includes('obj') && !textNum[1].includes('endobj')) {
        setInvoiceNumber(textNum[1].trim())
      }

      // Search for euro amounts (handles 1.250,00 or 1250,00 or 665.50)
      const eurMatches =
        content.match(/(?:€|EUR|eur|euro)[\s:]*([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/gi) ||
        content.match(/([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})[\s]*(?:€|EUR)/gi) ||
        content.match(/(?:totaal|total|subtotaal)[\s:]*([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/gi)

      if (eurMatches && eurMatches.length > 0) {
        let maxVal = 0
        for (const m of eurMatches) {
          const clean = m.replace(/(?:€|EUR|eur|euro|totaal|total|subtotaal|[\s:])/gi, '')
          // Convert Dutch format 1.250,00 or 665,50 to standard 1250.00 / 665.50
          let norm = clean
          if (clean.includes(',') && clean.includes('.')) {
            norm = clean.replace(/\./g, '').replace(',', '.')
          } else if (clean.includes(',')) {
            norm = clean.replace(',', '.')
          }
          const val = parseFloat(norm)
          if (!isNaN(val) && val > maxVal && val < 500000) {
            maxVal = val
          }
        }
        if (maxVal > 0) {
          const excl = Math.round((maxVal / 1.21) * 100) / 100
          recalculateAmounts(excl, '21')
        }
      }

      // Search for dates
      const dateMatch =
        content.match(/\b(202\d[-/.](?:0[1-9]|1[0-2])[-/.](?:0[1-9]|[12]\d|3[01]))\b/) ||
        content.match(/\b((?:0[1-9]|[12]\d|3[01])[-/.](?:0[1-9]|1[0-2])[-/.](?:202\d))\b/)

      if (dateMatch && dateMatch[1]) {
        let rawD = dateMatch[1].replace(/[/.]/g, '-')
        const parts = rawD.split('-')
        let normalizedDate = rawD
        if (parts[0].length === 2 && parts[2].length === 4) {
          // DD-MM-YYYY -> YYYY-MM-DD
          normalizedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
        }
        setIssueDate(normalizedDate)
        setDueDate(normalizedDate)
      }

      toast.success('PDF geanalyseerd! Controleer de gegevens hieronder.')
    } catch (err) {
      console.warn('PDF parsing error:', err)
      toast('PDF geladen. Vul de details in.', { icon: '📄' })
    } finally {
      setIsParsing(false)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      parsePdfFile(acceptedFiles[0])
    }
  }, [clients])

  const onDropRejected = useCallback((fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      const rej = fileRejections[0]
      if (rej.file?.name?.toLowerCase().endsWith('.pdf')) {
        parsePdfFile(rej.file)
      } else {
        toast.error('Selecteer alstublieft een geldig PDF bestand (.pdf)')
      }
    }
  }, [clients])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'application/pdf': ['.pdf'],
      'application/x-pdf': ['.pdf'],
      'application/octet-stream': ['.pdf'],
      '*/*': ['.pdf'],
    },
    maxFiles: 1,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoiceNumber.trim()) {
      toast.error('Vul een factuurnummer in')
      return
    }

    setIsSaving(true)
    try {
      let finalClientId = clientId
      if (clientId === 'NEW' && newClientName.trim()) {
        const newClient = await clientsApi.create({
          name: newClientName.trim(),
          country_code: 'NL',
          default_payment_term_days: 14,
        })
        finalClientId = newClient.id
        qc.invalidateQueries({ queryKey: ['clients'] })
      }

      const validClientId = (finalClientId && finalClientId !== 'NEW' && finalClientId.length > 5) ? finalClientId : undefined
      const clientObj = clients.find(c => c.id === validClientId)

      // Prepare comprehensive invoice payload compatible with both Supabase and local cache
      const invoiceData = {
        invoice_number: invoiceNumber.trim(),
        client_id: validClientId,
        client: clientObj,
        status: status,
        issue_date: issueDate,
        due_date: dueDate,
        paid_at: status === 'PAID' ? (issueDate ? new Date(issueDate).toISOString() : new Date().toISOString()) : null,
        subtotal_excl: Number(amountExcl),
        subtotal_excl_vat: Number(amountExcl),
        total_vat: Number(vatAmount),
        total_vat_amount: Number(vatAmount),
        total_incl: Number(amountIncl),
        total_incl_vat: Number(amountIncl),
        notes: description,
        pdf_path: pdfDataUrl || undefined,
        line_items: [
          {
            description: description || `Historische factuur ${invoiceNumber}`,
            quantity: 1,
            unit_price: Number(amountExcl),
            vat_rate: vatRate,
            vat_amount: Number(vatAmount),
            line_total_excl: Number(amountExcl),
            line_total_incl: Number(amountIncl),
            total_excl_vat: Number(amountExcl),
            total_vat: Number(vatAmount),
            total_incl_vat: Number(amountIncl),
          },
        ],
      }

      const created = await invoicesApi.create(invoiceData)

      // Check if any bank transactions match this invoice number
      try {
        const txs = await bankApi.transactions()
        const matchTx = txs.find(t =>
          (t.remittance_reference && t.remittance_reference.includes(invoiceNumber.trim())) ||
          (Math.abs(Number(t.amount) - Number(amountIncl)) < 0.05 && (t.type === 'CREDIT' || (t as any).transaction_type === 'CREDIT'))
        )
        if (matchTx && created && created.id) {
          await bankApi.match(matchTx.id, created.id)
        }
      } catch {
        // ignore matching error
      }

      toast.success(`Factuur ${invoiceNumber} succesvol opgeslagen!`)
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      onClose()
    } catch (err: any) {
      console.error('Opslaan mislukt:', err)
      toast.error('Opslaan van historische factuur mislukt')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl shadow-2xl animate-fade-in my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 text-brand-400 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-base">Historische factuur importeren (PDF)</h3>
              <p className="text-xs text-slate-400">Voeg een eerdere factuur toe aan uw administratie</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-4 sm:p-6 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-brand-500 bg-brand-600/10'
                : file
                ? 'border-emerald-500/50 bg-emerald-950/10'
                : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 text-emerald-400">
                  <Check size={18} />
                  <span className="text-xs sm:text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-slate-500 font-mono">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
                <p className="text-[11px] text-slate-400">Klik of sleep een andere PDF om te vervangen</p>
              </div>
            ) : (
              <div>
                <Upload size={24} className="mx-auto mb-1.5 text-slate-400" />
                <p className="text-xs sm:text-sm text-slate-200 font-medium">
                  {isParsing ? 'PDF analyseren...' : 'Sleep PDF factuur hierheen of klik om te kiezen'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">AliBirds leest factuurnummer en bedragen automatisch uit</p>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Factuurnummer *</label>
              <input
                className="input text-xs sm:text-sm font-mono"
                placeholder="bijv. 2026-0001"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label text-xs">Status</label>
              <select
                className="select text-xs sm:text-sm"
                value={status}
                onChange={e => setStatus(e.target.value as 'PAID' | 'SENT')}
              >
                <option value="PAID">Betaald (Voltooid)</option>
                <option value="SENT">Verzonden (Nog openstaand)</option>
              </select>
            </div>
          </div>

          {/* Client selector */}
          <div>
            <label className="label text-xs">Opdrachtgever / Klant</label>
            <div className="space-y-2">
              <select
                className="select text-xs sm:text-sm"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
              >
                <option value="">-- Geen / Kies bestaande klant --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="NEW">+ Nieuwe klant invoeren...</option>
              </select>

              {clientId === 'NEW' && (
                <input
                  className="input text-xs sm:text-sm animate-fade-in"
                  placeholder="Bedrijfsnaam van de nieuwe klant..."
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  autoFocus
                />
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Factuurdatum</label>
              <input
                type="date"
                className="input text-xs sm:text-sm"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Vervaldatum</label>
              <input
                type="date"
                className="input text-xs sm:text-sm"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Financials */}
          <div className="grid grid-cols-3 gap-2.5 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="label text-xs">Excl. btw (€)</label>
              <input
                type="number"
                step="0.01"
                className="input text-xs font-mono text-right"
                value={amountExcl || ''}
                onChange={e => recalculateAmounts(parseFloat(e.target.value) || 0, vatRate)}
              />
            </div>
            <div>
              <label className="label text-xs">Btw-tarief</label>
              <select
                className="select text-xs"
                value={vatRate}
                onChange={e => recalculateAmounts(amountExcl, e.target.value)}
              >
                <option value="21">21% hoog</option>
                <option value="9">9% laag</option>
                <option value="0">0% nul</option>
                <option value="REVERSE_CHARGE">Verlegd</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Totaal incl. (€)</label>
              <input
                type="number"
                step="0.01"
                className="input text-xs font-mono text-right font-bold text-emerald-400"
                value={amountIncl || ''}
                onChange={e => {
                  const inc = parseFloat(e.target.value) || 0
                  setAmountIncl(inc)
                  const mult = vatRate === 'REVERSE_CHARGE' ? 0 : Number(vatRate) / 100
                  const exc = mult > 0 ? Math.round((inc / (1 + mult)) * 100) / 100 : inc
                  setAmountExcl(exc)
                  setVatAmount(Math.round((inc - exc) * 100) / 100)
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label text-xs">Omschrijving / Referentie</label>
            <input
              className="input text-xs sm:text-sm"
              placeholder="bijv. Geleverde adviesdiensten 2025"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs sm:text-sm py-2 px-3"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary text-xs sm:text-sm py-2 px-4 flex items-center gap-1.5"
            >
              <Check size={15} />
              {isSaving ? 'Opslaan...' : 'Factuur opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
