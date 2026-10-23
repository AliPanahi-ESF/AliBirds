import React, { useState } from 'react'
import { X, Building2, User, Mail, MapPin, Hash, Plus, Check } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { clientsApi } from '@/lib/api'
import { Client } from '@/lib/types'

interface QuickClientModalProps {
  isOpen: boolean
  onClose: () => void
  onClientCreated: (newClient: Client) => void
}

interface QuickClientFormData {
  name: string
  contact_person?: string
  email?: string
  billing_address_street?: string
  billing_address_postcode?: string
  billing_address_city?: string
  vat_number?: string
  kvk_number?: string
  country_code?: string
  default_payment_term_days?: number
}

export default function QuickClientModal({
  isOpen,
  onClose,
  onClientCreated,
}: QuickClientModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<QuickClientFormData>({
    defaultValues: {
      name: '',
      contact_person: '',
      email: '',
      billing_address_street: '',
      billing_address_postcode: '',
      billing_address_city: '',
      vat_number: '',
      kvk_number: '',
      country_code: 'NL',
      default_payment_term_days: 14,
    },
  })

  if (!isOpen) return null

  const onSubmit = async (data: QuickClientFormData) => {
    setIsSubmitting(true)
    try {
      const created = await clientsApi.create({
        ...data,
        country_code: data.country_code || 'NL',
        default_payment_term_days: data.default_payment_term_days || 14,
      })
      toast.success(`Klant "${created.name}" succesvol toegevoegd!`)
      reset()
      onClientCreated(created)
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Kon klant niet aanmaken')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-client-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg liquid-glass-dialog p-5 sm:p-6 overflow-hidden max-h-[90vh] flex flex-col transition-all shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600/20 text-brand-400 flex items-center justify-center border border-brand-500/30">
              <Building2 size={16} />
            </div>
            <div>
              <h2 id="quick-client-title" className="text-sm sm:text-base font-bold text-slate-100">
                Nieuwe klant toevoegen
              </h2>
              <p className="text-[11px] text-slate-400">Wordt direct geselecteerd voor deze factuur</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Sluiten"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 pt-4 overflow-y-auto pr-1">
          {/* Bedrijfsnaam */}
          <div>
            <label className="label">Bedrijfsnaam / Klantnaam *</label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="bijv. Acme Studio B.V."
                className="input text-xs sm:text-sm pl-8"
                {...register('name', { required: 'Bedrijfsnaam is verplicht' })}
              />
              <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
            {errors.name && (
              <p className="text-red-400 text-[11px] mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Contactpersoon & E-mail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Contactpersoon</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="bijv. Jan Jansen"
                  className="input text-xs sm:text-sm pl-8"
                  {...register('contact_person')}
                />
                <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="label">Facturatie E-mail</label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="facturen@klant.nl"
                  className="input text-xs sm:text-sm pl-8"
                  {...register('email')}
                />
                <Mail size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </div>

          {/* Adresgegevens */}
          <div>
            <label className="label">Straat en Huisnummer</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Keizersgracht 101"
                className="input text-xs sm:text-sm pl-8"
                {...register('billing_address_street')}
              />
              <MapPin size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="label">Postcode</label>
              <input
                type="text"
                placeholder="1015 CJ"
                className="input text-xs sm:text-sm"
                {...register('billing_address_postcode')}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Stad</label>
              <input
                type="text"
                placeholder="Amsterdam"
                className="input text-xs sm:text-sm"
                {...register('billing_address_city')}
              />
            </div>
          </div>

          {/* Btw-nummer & KVK */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="label">BTW-identificatienummer</label>
              <input
                type="text"
                placeholder="NL123456789B01"
                className="input text-xs sm:text-sm font-mono"
                {...register('vat_number')}
              />
            </div>
            <div>
              <label className="label">KVK-nummer</label>
              <input
                type="text"
                placeholder="12345678"
                className="input text-xs sm:text-sm font-mono"
                {...register('kvk_number')}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-white/10 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="py-2 px-3.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md shadow-brand-600/30 transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Opslaan...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>Klant toevoegen & Selecteren</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
