// The starting catalog of equipment/services — same list your WhatsApp
// bot used. This only matters the FIRST time the app runs against a
// fresh Firestore database (see lib/data.js -> ensureCatalogSeeded).
// After that, everything is edited from the Firestore data itself, and
// new items added on the invoice page are saved there permanently.

export const CATALOG_SEED = [
  { name: "Concrete Mixer", type: "daily", rate: 150000 },
  { name: "Concrete Pump", type: "daily", rate: 1500000 },
  { name: "Stationary Pump", type: "daily", rate: 500000 },
  { name: "Excavator", type: "daily", rate: 1800000 },
  { name: "Diesel", type: "daily", rate: 1200 },
  { name: "Mobilization", type: "flat", rate: 10000 },
  { name: "Demobilization", type: "flat", rate: 10000 },
];

export const BANK_ACCOUNTS_SEED = [
  {
    bankName: "Fidelity Bank",
    accountName: "Premix Trust Concrete Limited",
    accountNumber: "4010683874",
  },
];

export const COMPANY_INFO_SEED = {
  companyName: "Premix Trust Concrete Limited",
  rcNumber: "793803",
  vatNumber: "09211347-0001",
  prefix: "PTC",
};
