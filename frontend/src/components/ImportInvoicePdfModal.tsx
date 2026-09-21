import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { X, Upload, FileText, Check, AlertCircle, Building2, Calendar, Eye, Sparkles } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { invoicesApi, clientsApi, bankApi } from '@/lib/api'
import { Client } from '@/lib/types'
import { parsePdfInvoice, ExtractedInvoiceData } from '@/lib/pdfInvoiceParser'

interface Props {
  clients: Client[]
  onClose: () => void
}

export default function ImportInvoicePdfModal({ clients, onClose }: Props) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null)
  const [parsedInfo, setParsedInfo] = useState<ExtractedInvoiceData | null>(null)
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
      // Use our high-accuracy PDF stream decompressor & text extractor
      const parsed = await parsePdfInvoice(selectedFile, clients)
      setParsedInfo(parsed)

      // Auto-populate invoice number
      if (parsed.invoiceNumber) {
        setInvoiceNumber(parsed.invoiceNumber)
      }

      // Auto-populate client
      if (parsed.matchedClientId) {
        setClientId(parsed.matchedClientId)
        if (parsed.matchedClientId === 'NEW') {
          setNewClientName(parsed.matchedClientName)
        }
      } else if (parsed.counterparty) {
        setClientId('NEW')
        setNewClientName(parsed.counterparty)
      }

      // Auto-populate dates
      if (parsed.date) {
        setIssueDate(parsed.date)
        setDueDate(parsed.date)
      }

      // Auto-populate amounts
      if (parsed.amountIncl > 0) {
        setAmountIncl(parsed.amountIncl)
        setAmountExcl(parsed.amountExcl)
        setVatAmount(parsed.vatAmount)
        setVatRate(parsed.vatRate)
      }

      // Auto-populate description
      if (parsed.reference) {
        setDescription(parsed.reference)
      }

      toast.success(
        `PDF succesvol uitgelezen! ${parsed.counterparty ? parsed.counterparty + ' - ' : ''}€ ${parsed.amountIncl > 0 ? parsed.amountIncl.toFixed(2) : ''}`,
        { icon: '📄', duration: 4000 }
      )
    } catch (err) {
      console.warn('PDF parsing error:', err)
      toast('PDF geopend. U kunt de gegevens handmatig aanvullen.', { icon: '📄' })
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

          {/* Parsed feedback indicator */}
          {parsedInfo && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2.5 animate-fade-in">
              <Sparkles size={16} className="text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold text-emerald-200">PDF gegevens automatisch herkend:</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-300 text-[11px]">
                  {parsedInfo.counterparty && (
                    <span>Klant/Tegenpartij: <strong className="text-white">{parsedInfo.counterparty}</strong></span>
                  )}
                  {parsedInfo.invoiceNumber && (
                    <span>Factuur/Ref: <strong className="text-white">{parsedInfo.invoiceNumber}</strong></span>
                  )}
                  {parsedInfo.amountIncl > 0 && (
                    <span>Bedrag: <strong className="text-emerald-400">€ {parsedInfo.amountIncl.toFixed(2)}</strong></span>
                  )}
                  {parsedInfo.date && (
                    <span>Datum: <strong className="text-white">{parsedInfo.date}</strong></span>
                  )}
                </div>
              </div>
            </div>
          )}

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
                <option key="opt-default" value="">-- Geen / Kies bestaande klant --</option>
                {clients.map((c, idx) => (
                  <option key={c.id || `client-opt-${idx}`} value={c.id}>{c.name}</option>
                ))}
                <option key="opt-new" value="NEW">+ Nieuwe klant invoeren...</option>
              </select>

              <div key="new-client-container">
                {clientId === 'NEW' ? (
                  <input
                    key="new-client-input"
                    className="input text-xs sm:text-sm animate-fade-in"
                    placeholder="Bedrijfsnaam van de nieuwe klant..."
                    value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                    autoFocus
                  />
                ) : null}
              </div>
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
              <span>Annuleren</span>
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary text-xs sm:text-sm py-2 px-4 flex items-center gap-1.5"
            >
              <Check size={15} />
              <span>{isSaving ? 'Opslaan...' : 'Factuur opslaan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
