# PremiX Dashboard — Step 1: Invoices

This is the first piece of the combined PremiX app: generate an invoice,
which automatically counts as income. Expenses and the dashboard come
next, built into this same project.

## What's in here

- `src/app/page.js` — the invoice builder page (the whole UI)
- `src/components/` — the catalog picker, items table, terms editor
- `src/lib/data.js` — all the Firestore reading/writing (catalog, bank
  accounts, invoice numbers, saving invoices)
- `src/lib/pdf/generateInvoicePdf.js` — builds the actual PDF, matching
  the layout from your sample invoice (letterhead, details table, items,
  VAT, amount in words, terms, prepared-by, signature, bank details)
- `src/app/api/generate-invoice/route.js` — the button click hits this,
  it builds the PDF and saves the invoice + income record to Firestore
- `public/brand/letterhead.pdf` — copied over from your WhatsApp bot

## Getting it running (step by step)

1. **Install Node.js** if you don't have it: https://nodejs.org (get the
   LTS version).

2. **Open a terminal in this folder** and run:
   ```
   npm install
   ```

3. **Connect Firebase.** Go to https://console.firebase.google.com and
   open the same Firebase project your expense tracker already uses
   (so everything lands in one filing cabinet).
   - Project settings (gear icon) -> General -> scroll to "Your apps"
   - If there's no Web app yet, click "Add app" -> Web
   - Copy the config values shown

4. Rename `.env.local.example` to `.env.local` and paste those values
   in. This file is already ignored by git, so it stays private.

5. In the Firebase console, also turn on:
   - **Firestore Database** (if not already on) — start in production
     mode, pick your region
   - **Firestore security rules** — for now, while testing, you can
     allow read/write; lock this down before going fully live

6. Run it locally:
   ```
   npm run dev
   ```
   Open http://localhost:3000 — you should see the invoice builder.

7. The first time you load the page, it automatically creates the
   starting catalog (Concrete Mixer, Concrete Pump, Excavator, Diesel,
   Mobilization, Demobilization) and your Fidelity Bank account inside
   Firestore — same data your WhatsApp bot had.

## Deploying (same as your expense tracker)

Push this folder to a GitHub repo, then import it into Vercel. In
Vercel's project settings -> Environment Variables, add the same six
`NEXT_PUBLIC_FIREBASE_...` values from your `.env.local`. Vercel will
build and deploy automatically from then on, same CI/CD flow as before.

## What's next

Once this feels right, tell me and we'll build the **Expenses** page
inside this same project, reusing the same Firestore database — then
the **Dashboard** page last, which reads from the `transactions`
collection this invoice page already writes to.
# premix-app
