// src/lib/data.js
//
// All the "talk to Firestore" logic lives here, in plain functions, so
// the page components stay simple. Firestore is organized into
// collections (think: labeled drawers in the filing cabinet):
//
//   settings/company     -> company info, VAT number, invoice prefix
//   catalog/{itemId}      -> equipment/service catalog items
//   bankAccounts/{id}     -> saved bank accounts
//   invoices/{id}          -> every generated invoice
//   transactions/{id}     -> one row per money movement (income or
//                             expense) — this is what the future
//                             dashboard page will read from directly.

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  query,
  orderBy,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { CATALOG_SEED, BANK_ACCOUNTS_SEED, COMPANY_INFO_SEED } from "./catalogSeed";

// ---------- Company settings ----------

export async function getCompanyInfo() {
  const ref = doc(db, "settings", "company");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, COMPANY_INFO_SEED);
    return COMPANY_INFO_SEED;
  }
  return snap.data();
}

// ---------- Catalog ----------

export async function getCatalog() {
  const snap = await getDocs(collection(db, "catalog"));
  if (snap.empty) {
    // First run against a fresh database — plant the starting catalog.
    const seeded = [];
    for (const item of CATALOG_SEED) {
      const ref = await addDoc(collection(db, "catalog"), item);
      seeded.push({ id: ref.id, ...item });
    }
    return seeded;
  }
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addCatalogItem(item) {
  const ref = await addDoc(collection(db, "catalog"), item);
  return { id: ref.id, ...item };
}

// ---------- Bank accounts ----------

export async function getBankAccounts() {
  const snap = await getDocs(collection(db, "bankAccounts"));
  if (snap.empty) {
    const seeded = [];
    for (const acc of BANK_ACCOUNTS_SEED) {
      const ref = await addDoc(collection(db, "bankAccounts"), acc);
      seeded.push({ id: ref.id, ...acc });
    }
    return seeded;
  }
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- Invoice numbering ----------
// Uses a Firestore transaction so two people generating invoices at the
// same moment can never get the same number.

export async function nextInvoiceNumber() {
  const counterRef = doc(db, "settings", "invoiceCounter");
  const company = await getCompanyInfo();
  const prefix = company.prefix || "PTC";

  const number = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? snap.data().nextNumber || 1 : 1;
    tx.set(counterRef, { nextNumber: current + 1 }, { merge: true });
    return current;
  });

  return `${prefix}-${String(number).padStart(4, "0")}`;
}

// ---------- Saving a finished invoice ----------
// Saving an invoice does two things, same as described in the plan:
// 1. stores the full invoice
// 2. drops a matching row into "transactions" so the dashboard can add
//    it up as income, per vehicle/company, without re-reading invoices.

export async function saveInvoiceAndRegisterIncome(invoice, totals) {
  const invoiceRef = await addDoc(collection(db, "invoices"), {
    ...invoice,
    createdAt: serverTimestamp(),
  });

  await addDoc(collection(db, "transactions"), {
    type: "income",
    source: "invoice",
    invoiceId: invoiceRef.id,
    invoiceNumber: invoice.number,
    customerName: invoice.customerName,
    amount: totals.grandTotal,
    date: invoice.date,
    createdAt: serverTimestamp(),
  });

  return invoiceRef.id;
}

export async function getInvoices() {
  const q = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
