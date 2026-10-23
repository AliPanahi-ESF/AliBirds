---
name: holistic-app-qa
description: Protocol and automated verification checklist to ensure the entire AliBirds application works together seamlessly across mobile, desktop, touch ergonomics, iOS safe areas, native haptics, bilingual EN/NL coherence, and Dutch tax compliance.
---

# AliBirds Holistic Application Quality Assurance Protocol

Use this skill whenever working on, modifying, or testing any component or page in the AliBirds repository. It ensures that changes in one module never break other parts of the system, and that mobile touch devices (especially iPhone) feel like high-end native iOS applications.

---

## The 7 Non-Negotiable System Vectors

Every change in AliBirds must pass all 7 vectors before being considered ready:

### 1. 📱 iOS Dynamic Island, Notch & Safe Area Integrity
* **The Rule:** Any fixed or sticky container (`MobileHeader`, `Sidebar` drawer, `BottomNav`, floating modals) must never hide behind the iOS status bar (clock, battery, Dynamic Island) or the bottom Home Indicator.
* **Implementation:**
  * Top bar: Container uses `.safe-area-pt` (`padding-top: env(safe-area-inset-top)`) and contains a child `h-14` flex row for its contents. Never use fixed container heights (like `h-[58px]`) with `safe-area-pt` because iPhone 14/15/16 Pro top insets are 59px.
  * Bottom bar: Container uses `.safe-area-pb` (`padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px))`).
  * Main content wrapper: Bottom padding must be at least `pb-[calc(90px+env(safe-area-inset-bottom,0px))] md:pb-8`.
  * Mobile Menu Drawer (`Sidebar.tsx`): Header container must have `.safe-area-pt` so the logo, language switcher, and close button render strictly below the notch. Footer must have `.safe-area-pb`.

### 2. 👆 Touch Ergonomics ($\ne$ Mouse Pointer) & Haptics
* **Target Size:** Every interactive element on mobile must have a minimum touch target of $\ge 40\text{px}–44\text{px}$.
* **Active State:** All mobile tap targets must include `active:scale-95` (or `active:scale-[0.98]`) for tactile compression feedback.
* **No Accidental Mis-taps:** Destructive actions (like red delete buttons) must never be placed as large primary buttons next to creative actions (like "Nieuwe factuur").
* **Touch Highlight:** Global `-webkit-tap-highlight-color: transparent` must remain enabled in `index.css`.
* **Cross-Platform Haptics:** Call `triggerHaptic(...)` from `@/lib/haptics`:
  * iOS Safari does not support `navigator.vibrate()`. The engine utilizes the iOS 18 `<input type="checkbox" switch>` label click trigger and Web Audio sub-bass impulse.
  * Use `selection` for tab switches and bottom nav clicks.
  * Use `light` for button taps and modal triggers.
  * Use `medium` for primary CTA conversions.
  * Use `warning` for deletions and destructive confirmations.
  * Use `success` for saves and signatures.

### 3. 🌐 Bilingual Coherence (Nederlands & English)
* **The Rule:** No hardcoded user-facing strings in UI components.
* **Implementation:**
  * Always use `const { t, locale } = useI18n()` from `@/lib/i18n`.
  * When adding new features, add corresponding keys in both `nl` and `en` dictionaries in `src/lib/i18n.tsx`.
  * Status maps (`statusMap`) must dynamically resolve their labels using `t(...)` so that switching language immediately updates all cards, tables, badges, and filters.
  * Format currencies and dates through `fmt.currency(...)` and `fmt.date(...)`.

### 4. 🇳🇱 Dutch Tax Law & Belastingdienst Legal Compliance
* **The Rule:** Zero tolerance for VAT arithmetic errors or non-sequential invoice numbering.
* **Verification Command:**
  ```bash
  cd frontend && npm test
  ```
  All 20 real-code legal edge case tests must pass:
  * 21% standard, 9% reduced, 0% zero rate, and Btw Verlegd (Reverse Charge).
  * Strict domestic reverse charge (Rubriek 1e) vs EU ICP (Rubriek 3b).
  * Commercial half-cent rounding and whole-euro tax return rounding.
  * Strict sequential numbering integrity (no random suffixes or gaps).
  * Official quarterly filing deadline dates (30 Apr, 31 Jul, 31 Oct, 31 Jan).

### 5. ⚡ Dev Performance & Service Worker Stability
* **The Rule:** Never cause background reload loops or CPU spikes.
* **Implementation:**
  * Service Workers must be disabled in dev mode (`!import.meta.env.DEV` in `main.tsx`).
  * Never call `self.skipWaiting()` automatically in `sw.js`.
  * PWA updates must prompt politely via `AppUpdatePrompt.tsx` and only reload when the user explicitly clicks "Nu Bijwerken".

### 6. 📱 Responsive Form Layouts (Stacked Cards on Mobile)
* **The Rule:** Tables with 4+ columns must never force horizontal scrolling or column crushing on mobile screens ($< 640\text{px}$).
* **Implementation:**
  * Line items in `InvoiceEditor.tsx` and `QuotationEditor.tsx` render as full-width vertical stacked cards on screens $< 640\text{px}` (`block sm:hidden`).
  * Invoices and Quotations list pages use responsive card views (`md:hidden`) with direct 1-tap quick action buttons (`PDF`, `Send`, `Edit`, `Delete`).

### 7. 🏗️ Compilation & Production Build Sanity
* **Verification Command:**
  ```bash
  cd frontend && npm run build
  ```
  Must compile in $< 5$ seconds with 0 TypeScript errors and 0 missing imports.

---

## Holistic QA Execution Checklist

Run through this checklist before completing any task:

```bash
# 1. Verify Legal & Tax Test Suite
cd frontend && npm test

# 2. Verify Production Build & Type Integrity
npm run build

# 3. Check Git Status for uncommitted or untracked files
git status
```
