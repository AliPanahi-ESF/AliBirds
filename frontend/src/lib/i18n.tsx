import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type Locale = 'nl' | 'en'

const translations: Record<Locale, Record<string, string>> = {
  nl: {
    // Branding & App
    'app.name': 'AliBirds',
    'app.tagline': 'ZZP Boekhouding',
    'app.subtitle': "Zelf-gehoste facturatie & btw-aangifte voor Nederlandse ZZP'ers",
    'app.secured': 'Beveiligd',
    'app.cloud_session': 'Cloud Sessie Actief',
    'app.demo_session': 'Demo Sessie',
    'app.local_session': 'Lokale Sessie',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.invoices': 'Facturen',
    'nav.quotations': 'Offertes',
    'nav.clients': 'Klanten',
    'nav.bank': 'Bankafschriften',
    'nav.tax': 'Btw-aangifte',
    'nav.expenses': 'Kosten',
    'nav.recurring': 'Herhaalfacturen',
    'nav.settings': 'Instellingen',
    'nav.logout': 'Uitloggen',
    'nav.login': 'Inloggen',
    'nav.menu': 'Menu',
    'nav.overview': 'Overzicht',
    'nav.close_menu': 'Sluit menu',
    'nav.new_invoice_short': 'Factuur',

    // Actions & Buttons
    'btn.save': 'Opslaan',
    'btn.cancel': 'Annuleren',
    'btn.delete': 'Verwijderen',
    'btn.edit': 'Bewerken',
    'btn.create': 'Aanmaken',
    'btn.close': 'Sluiten',
    'btn.new_invoice': 'Nieuwe factuur',
    'btn.new_quotation': 'Nieuwe offerte',
    'btn.new_client': 'Nieuwe klant',
    'btn.new_expense': 'Nieuwe uitgave',
    'btn.add_line': 'Regel toevoegen',
    'btn.import_bank': 'MT940 Bank',
    'btn.download_pdf': 'PDF Downloaden',
    'btn.send_email': 'Versturen via e-mail',
    'btn.change_password': 'Wachtwoord opslaan',
    'btn.export_data': 'Administratie exporteren (JSON)',
    'btn.exporting': 'Gegevens exporteren...',
    'btn.demo_studio': '1-Click Demo Studio (Zonder inloggen)',
    'btn.verify': 'Verifiëren',
    'btn.verify_login': 'Code verifiëren & Inloggen',

    // Filter Tabs
    'filter.all': 'Alles',
    'filter.paid': 'Betaald',
    'filter.outstanding': 'Openstaand',
    'filter.draft': 'Concept',
    'filter.overdue': 'Verlopen',
    'filter.sent': 'Verzonden',
    'filter.cancelled': 'Geannuleerd',

    // Auth Screen
    'auth.login_tab': 'Inloggen',
    'auth.register_tab': 'Account aanmaken',
    'auth.email': 'E-mailadres',
    'auth.password': 'Wachtwoord',
    'auth.full_name': 'Uw volledige naam',
    'auth.forgot_password': 'Vergeten?',
    'auth.resend_confirmation': 'Bevestiging opnieuw?',
    'auth.have_code': 'Heeft u een verificatiecode ontvangen?',
    'auth.enter_code_link': 'Code invoeren',
    'auth.or_view_direct': 'Of direct bekijken',
    'auth.reset_password_title': 'Nieuw wachtwoord instellen',
    'auth.reset_password_desc': 'Kies een nieuw veilig wachtwoord voor uw AliBirds account.',
    'auth.new_password': 'Nieuw wachtwoord',
    'auth.confirm_password': 'Bevestig nieuw wachtwoord',
    'auth.min_chars': 'Minimaal 6 tekens',
    'auth.save_and_login': 'Wachtwoord opslaan & Inloggen',
    'auth.back_to_login': 'Terug naar inloggen',
    'auth.verify_code_title': 'Verificatiecode invoeren',
    'auth.verify_code_desc': 'Voer de 6-cijferige code of het token uit de e-mail hieronder handmatig in.',
    'auth.code_placeholder': '6 cijfers of token uit link',
    'auth.security_notice': 'Uw gegevens zijn beveiligd en privé. Elke gebruiker heeft een eigen afgeschermd account.',

    // Dashboard
    'dash.title': 'Dashboard',
    'dash.quarter': 'Kwartaal',
    'dash.kpi.outstanding': 'Openstaand',
    'dash.kpi.overdue': 'Verlopen',
    'dash.kpi.to_collect': 'Te incasseren',
    'dash.kpi.vat_estimate': 'Btw (geschat)',
    'dash.kpi.to_pay_bd': 'Te betalen aan BD',
    'dash.kpi.paid_this_quarter': 'Betaald dit kwartaal',
    'dash.kpi.received_net': 'Reeds ontvangen omzet',
    'dash.recent_invoices': 'Recente facturen',
    'dash.all_invoices': 'Alle facturen',
    'dash.no_invoices': 'Nog geen facturen aangemaakt.',
    'dash.status.paid': 'Betaald',
    'dash.status.sent': 'Verzonden',
    'dash.status.draft': 'Concept',
    'dash.status.overdue': 'Verlopen',

    // Invoices & Quotations
    'inv.title': 'Facturen',
    'inv.new_title': 'Nieuwe factuur maken',
    'inv.number': 'Factuurnummer',
    'inv.client': 'Opdrachtgever',
    'inv.select_client': 'Selecteer een klant...',
    'inv.date': 'Factuurdatum',
    'inv.due_date': 'Vervaldatum',
    'inv.terms': 'Betaaltermijn',
    'inv.lines': 'Factuurregels',
    'inv.desc': 'Omschrijving werkzaamheden',
    'inv.qty': 'Aantal',
    'inv.rate': 'Tarief (€)',
    'inv.vat': 'Btw-tarief',
    'inv.subtotal': 'Subtotaal excl. btw',
    'inv.vat_total': 'Btw totaal',
    'inv.total': 'Totaal incl. btw',
    'inv.vat_21': '21% (Standaard tarief)',
    'inv.vat_9': '9% (Laag tarief)',
    'inv.vat_0': '0% (Nultarief)',
    'inv.vat_reverse': 'Btw Verlegd (Reverse charge)',
    'inv.notes': 'Notities / Betaalinstructies',

    // Settings
    'settings.title': 'Instellingen',
    'settings.tab_company': 'Bedrijfsprofiel',
    'settings.tab_layout': 'Factuur Lay-out',
    'settings.tab_email': 'E-mail & Resend',
    'settings.tab_account': 'Account & Beveiliging',
    'settings.company_name': 'Bedrijfsnaam',
    'settings.trade_name': 'Handelsnaam',
    'settings.kvk': 'KVK-nummer',
    'settings.vat_id': 'Btw-identificatienummer',
    'settings.iban': 'IBAN Bankrekening',
    'settings.address': 'Vestigingsadres',
    'settings.postal_city': 'Postcode & Plaats',
    'settings.change_password_title': 'Wachtwoord Wijzigen',
    'settings.change_password_desc': 'Stel direct een nieuw veilig wachtwoord in voor uw account.',
    'settings.gdpr_title': 'Privacy & Gegevensbescherming (AVG)',
    'settings.gdpr_desc': 'Uw rechten op dataportabiliteit en wettelijke bewaarplicht.',
    'settings.gdpr_text': 'Conform de Algemene Verordening Gegevensbescherming (AVG/GDPR) heeft u te allen tijde het recht om uw administratie en klantgegevens te exporteren. Let op: op grond van artikel 52 AWR geldt voor ondernemers een fiscale bewaarplicht van 7 jaar.',
    'settings.language_title': 'Taal / Language',
    'settings.language_desc': 'Kies uw gewenste weergavetaal voor AliBirds.',

    // Tax
    'tax.title': 'Btw-aangifte',
    'tax.quarter': 'Kwartaal',
    'tax.rubric_1': 'Rubriek 1: Prestaties binnenland',
    'tax.rubric_3': 'Rubriek 3: Prestaties naar het buitenland',
    'tax.rubric_5': 'Rubriek 5: Eindberekening & Voorbelasting',
    'tax.total_due': 'Totaal te betalen / te ontvangen',
    'tax.whole_euros': 'Afgerond op hele euro’s conform Belastingdienst regels',

    // Language
    'lang.nl': 'Nederlands',
    'lang.en': 'English',
  },
  en: {
    // Branding & App
    'app.name': 'AliBirds',
    'app.tagline': 'ZZP Accounting',
    'app.subtitle': 'Self-hosted invoicing & VAT filing for Dutch freelancers and sole traders',
    'app.secured': 'Secured',
    'app.cloud_session': 'Cloud Session Active',
    'app.demo_session': 'Demo Session',
    'app.local_session': 'Local Session',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.invoices': 'Invoices',
    'nav.quotations': 'Quotations',
    'nav.clients': 'Clients',
    'nav.bank': 'Bank Statements',
    'nav.tax': 'VAT Return',
    'nav.expenses': 'Expenses',
    'nav.recurring': 'Recurring',
    'nav.settings': 'Settings',
    'nav.logout': 'Log out',
    'nav.login': 'Log in',
    'nav.menu': 'Menu',
    'nav.overview': 'Overview',
    'nav.close_menu': 'Close menu',
    'nav.new_invoice_short': 'Invoice',

    // Actions & Buttons
    'btn.save': 'Save',
    'btn.cancel': 'Cancel',
    'btn.delete': 'Delete',
    'btn.edit': 'Edit',
    'btn.create': 'Create',
    'btn.close': 'Close',
    'btn.new_invoice': 'New Invoice',
    'btn.new_quotation': 'New Quotation',
    'btn.new_client': 'New Client',
    'btn.new_expense': 'New Expense',
    'btn.add_line': 'Add Item',
    'btn.import_bank': 'MT940 Bank',
    'btn.download_pdf': 'Download PDF',
    'btn.send_email': 'Send via Email',
    'btn.change_password': 'Save Password',
    'btn.export_data': 'Export Ledger (JSON)',
    'btn.exporting': 'Exporting data...',
    'btn.demo_studio': '1-Click Demo Studio (No login required)',
    'btn.verify': 'Verify',
    'btn.verify_login': 'Verify Code & Log in',

    // Filter Tabs
    'filter.all': 'All',
    'filter.paid': 'Paid',
    'filter.outstanding': 'Outstanding',
    'filter.draft': 'Draft',
    'filter.overdue': 'Overdue',
    'filter.sent': 'Sent',
    'filter.cancelled': 'Cancelled',

    // Auth Screen
    'auth.login_tab': 'Log in',
    'auth.register_tab': 'Create Account',
    'auth.email': 'Email address',
    'auth.password': 'Password',
    'auth.full_name': 'Your full name',
    'auth.forgot_password': 'Forgot?',
    'auth.resend_confirmation': 'Resend confirmation?',
    'auth.have_code': 'Received a verification code?',
    'auth.enter_code_link': 'Enter code',
    'auth.or_view_direct': 'Or explore directly',
    'auth.reset_password_title': 'Set New Password',
    'auth.reset_password_desc': 'Choose a new secure password for your AliBirds account.',
    'auth.new_password': 'New password',
    'auth.confirm_password': 'Confirm new password',
    'auth.min_chars': 'Minimum 6 characters',
    'auth.save_and_login': 'Save Password & Log In',
    'auth.back_to_login': 'Back to log in',
    'auth.verify_code_title': 'Enter Verification Code',
    'auth.verify_code_desc': 'Enter the 6-digit code or link token from your email manually below.',
    'auth.code_placeholder': '6 digits or link token',
    'auth.security_notice': 'Your data is encrypted and private. Each business owner has an isolated workspace.',

    // Dashboard
    'dash.title': 'Dashboard',
    'dash.quarter': 'Quarter',
    'dash.kpi.outstanding': 'Outstanding',
    'dash.kpi.overdue': 'Overdue',
    'dash.kpi.to_collect': 'To collect',
    'dash.kpi.vat_estimate': 'VAT (estimated)',
    'dash.kpi.to_pay_bd': 'Payable to Tax Office',
    'dash.kpi.paid_this_quarter': 'Paid this quarter',
    'dash.kpi.received_net': 'Net received revenue',
    'dash.recent_invoices': 'Recent Invoices',
    'dash.all_invoices': 'All invoices',
    'dash.no_invoices': 'No invoices created yet.',
    'dash.status.paid': 'Paid',
    'dash.status.sent': 'Sent',
    'dash.status.draft': 'Draft',
    'dash.status.overdue': 'Overdue',

    // Invoices & Quotations
    'inv.title': 'Invoices',
    'inv.new_title': 'Create New Invoice',
    'inv.number': 'Invoice Number',
    'inv.client': 'Client',
    'inv.select_client': 'Select a client...',
    'inv.date': 'Invoice Date',
    'inv.due_date': 'Due Date',
    'inv.terms': 'Payment Terms',
    'inv.lines': 'Line Items',
    'inv.desc': 'Description of services or goods',
    'inv.qty': 'Qty',
    'inv.rate': 'Rate (€)',
    'inv.vat': 'VAT Rate',
    'inv.subtotal': 'Subtotal excl. VAT',
    'inv.vat_total': 'Total VAT',
    'inv.total': 'Total incl. VAT',
    'inv.vat_21': '21% (Standard rate)',
    'inv.vat_9': '9% (Reduced rate)',
    'inv.vat_0': '0% (Zero rate)',
    'inv.vat_reverse': 'Reverse Charge (Btw Verlegd)',
    'inv.notes': 'Notes / Payment Instructions',

    // Settings
    'settings.title': 'Settings',
    'settings.tab_company': 'Business Profile',
    'settings.tab_layout': 'Invoice Layout',
    'settings.tab_email': 'Email & Resend',
    'settings.tab_account': 'Account & Security',
    'settings.company_name': 'Company Name',
    'settings.trade_name': 'Trade Name',
    'settings.kvk': 'KVK Number',
    'settings.vat_id': 'VAT ID Number',
    'settings.iban': 'IBAN Bank Account',
    'settings.address': 'Business Address',
    'settings.postal_city': 'Postal Code & City',
    'settings.change_password_title': 'Change Password',
    'settings.change_password_desc': 'Instantly set a new secure password for your account.',
    'settings.gdpr_title': 'Privacy & Data Protection (GDPR)',
    'settings.gdpr_desc': 'Your right to data portability and statutory retention obligations.',
    'settings.gdpr_text': 'Under the General Data Protection Regulation (GDPR/AVG), you have the right to export your complete accounting ledger and client data at any time. Note: under Dutch tax law (Article 52 AWR), entrepreneurs have a statutory 7-year records retention obligation.',
    'settings.language_title': 'Language / Taal',
    'settings.language_desc': 'Choose your preferred display language for AliBirds.',

    // Tax
    'tax.title': 'VAT Return (Btw-aangifte)',
    'tax.quarter': 'Quarter',
    'tax.rubric_1': 'Section 1: Domestic Supplies (Prestaties binnenland)',
    'tax.rubric_3': 'Section 3: Cross-Border EU Supplies (Prestaties naar het buitenland)',
    'tax.rubric_5': 'Section 5: Final Balance & Input Tax (Voorbelasting)',
    'tax.total_due': 'Total Payable / Refundable',
    'tax.whole_euros': 'Rounded to whole euros in accordance with Dutch Tax Office rules',

    // Language
    'lang.nl': 'Nederlands',
    'lang.en': 'English',
  },
}

interface I18nContextType {
  locale: Locale
  setLocale: (l: Locale) => void
  toggleLocale: () => void
  t: (key: string, fallback?: string) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const STORAGE_KEY = 'alibirds_language'

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'en' || saved === 'nl') return saved
      // Default to Dutch for Netherlands ZZP context, but allow English detection if preferred
      if (navigator.language && navigator.language.startsWith('en')) {
        return 'en'
      }
    }
    return 'nl'
  })

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
      document.documentElement.lang = newLocale
    } catch {
      // ignore
    }
  }, [])

  const toggleLocale = useCallback(() => {
    setLocaleState(prev => {
      const next = prev === 'nl' ? 'en' : 'nl'
      try {
        localStorage.setItem(STORAGE_KEY, next)
        document.documentElement.lang = next
      } catch {}
      return next
    })
  }, [])

  const t = useCallback((key: string, fallback?: string): string => {
    const dict = translations[locale] || translations.nl
    if (dict && dict[key]) {
      return dict[key]
    }
    const nlDict = translations.nl
    if (nlDict && nlDict[key]) {
      return nlDict[key]
    }
    return fallback || key
  }, [locale])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, toggleLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
