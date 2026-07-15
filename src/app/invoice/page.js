"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Loader2 } from "lucide-react";
import CatalogPicker from "@/components/CatalogPicker";
import ItemsTable from "@/components/ItemsTable";
import TermsEditor from "@/components/TermsEditor";
import { getCatalog, addCatalogItem, getBankAccounts, getCompanyInfo } from "@/lib/data";
import { VEHICLES } from "@/lib/fleet";

const DEFAULT_TERMS = [
  "Client shall provide fuel for work — 100-150 litres depending on volume and duration of work.",
  "Client shall provide transport to and from work site or accommodation, residence and site is apart.",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function generateProjectNo(dateString) {
  if (!dateString || !dateString.includes("-")) return "";
  const parts = dateString.split("-");
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  // Strictly returns 0 + DD + MM + YYYY
  return `0${day}${month}${year}`; 
}

export default function InvoicePage() {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);

  const [form, setForm] = useState({
    customerName: "",
    contactPerson: "",
    customerPhone: "",
    site: "",
    driver: "",
    date: todayISO(),
    projectNo: generateProjectNo(todayISO()),
    subject: "",
    proformaTitle: "",
    discPct: 0,
    taxPct: 7.5,
    notes: "",
  });

  const [items, setItems] = useState([]);
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [preparedByName, setPreparedByName] = useState("");
  const [preparedByTitle, setPreparedByTitle] = useState("");
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  // Hardcoded list of your company's bank accounts
  const OUR_BANKS = [
    { id: "gtb", bankName: "GT BANK", accountName: "PREMIX TRUSCONCRETE LTD", accountNumber: "0040303449" },
    { id: "access", bankName: "Access Bank", accountName: "PREMIX TRUSCONCRETE LTD", accountNumber: "0102219662" },
    { id: "fidelity", bankName: "Fidelity Bank", accountName: "PREMIX TRUSCONCRETE LTD", accountNumber: "4010683874" },
  ];

  useEffect(() => {
    async function load() {
      try {
        // We removed getBankAccounts() from Firebase since we are using OUR_BANKS now
        const [cat, company] = await Promise.all([getCatalog(), getCompanyInfo()]);
        
        // Format your fleet to act as invoice catalog items
        const fleetItems = VEHICLES.map((v) => ({
          id: v.id,
          name: v.invoiceName,
          description: `Hire of ${v.invoiceName} (Operator: ${v.operator})`,
          rate: v.rate || 0,
          type: "per day",
          isEquipment: true,
        }));

        setCatalog([...fleetItems, ...cat]);
        
        // Inject the constant banks and set Fidelity as the default
        setBankAccounts(OUR_BANKS);
        setCompanyInfo(company);
        setSelectedBankId(OUR_BANKS[0].id); 
      } catch (e) {
        setError(
          "Couldn't connect to Firebase. Check that .env.local has your Firebase project keys."
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function updateField(key, value) {
    setForm((f) => {
      const nextForm = { ...f, [key]: value };
      // If the date changes, instantly update the project number too
      if (key === "date") {
        nextForm.projectNo = generateProjectNo(value);
      }
      return nextForm;
    });
  }

  function addItem(item) {
   setItems((prev) => [...prev, { ...item, qty: 1 }]);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // ADD THIS NEW FUNCTION FOR INLINE EDITING:
  function updateItem(idx, field, value) {
    setItems((prev) => {
      const newItems = [...prev];
      newItems[idx] = { ...newItems[idx], [field]: value };
      return newItems;
    });
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleAddNewCatalogItem(item) {
    const saved = await addCatalogItem(item);
    setCatalog((prev) => [...prev, saved]);
    return saved;
  }

  function handleSignatureUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSignatureFile(file);
    setSignaturePreview(URL.createObjectURL(file));
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleGenerate() {
    setError("");
    if (!form.customerName.trim()) {
      setError("Customer/company name is required.");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one item to the invoice.");
      return;
    }

    setGenerating(true);
    try {
      const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);

      const payload = {
        ...form,
        companyDisplayName: form.customerName,
        items,
        termsAndConditions: terms,
        vatNumber: companyInfo?.vatNumber || "",
        bankName: selectedBank?.bankName || "",
        accountName: selectedBank?.accountName || "",
        accountNumber: selectedBank?.accountNumber || ""
      };

      const res = await fetch("/api/generate-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || "Failed to generate invoice");
      }

      const invoiceNumber = res.headers.get("X-Invoice-Number") || "invoice";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setItems([]);
      setForm((f) => ({ ...f, customerName: "", contactPerson: "", customerPhone: "", site: "", driver: "", projectNo: "", subject: "", proformaTitle: "", notes: "" }));
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--brand-muted)]">Loading…</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="brand-diagonal text-white px-6 py-5">
        <h1 className="text-xl font-semibold">Premix TrustConcrete — Invoice Builder</h1>
        {/* <p className="text-sm text-white/80">Step 1 of 3 · Invoices → Expenses → Dashboard</p> */}
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-6">
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>
        )}

        {/* 2. Customer Details: 1 column on mobile, 2 on tablet, 3 on desktop */}
        <section className="card p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <h3 className="font-semibold text-[#3A2472] sm:col-span-2 md:col-span-3">Customer & job details</h3>
          
          <input placeholder="Customer / company name" value={form.customerName}
            onChange={(e) => updateField("customerName", e.target.value)}
            className="border border-[#E4DCF0] rounded px-3 py-2 w-full focus:border-[#C4237F] outline-none" />
            
          <input placeholder="Contact person" value={form.contactPerson}
            onChange={(e) => updateField("contactPerson", e.target.value)}
            className="border border-[#E4DCF0] rounded px-3 py-2 w-full focus:border-[#C4237F] outline-none" />
            
          <input placeholder="Customer phone / Email" value={form.customerPhone}
            onChange={(e) => updateField("customerPhone", e.target.value)}
            className="border border-[#E4DCF0] rounded px-3 py-2 w-full focus:border-[#C4237F] outline-none" />
            
          <input placeholder="Job site / delivery address" value={form.site}
            onChange={(e) => updateField("site", e.target.value)}
            className="border border-[#E4DCF0] rounded px-3 py-2 w-full sm:col-span-2 md:col-span-3 focus:border-[#C4237F] outline-none" />
            
          <input type="date" value={form.date}
            onChange={(e) => updateField("date", e.target.value)}
            className="border border-[#E4DCF0] rounded px-3 py-2 w-full focus:border-[#C4237F] outline-none" />
            
          <input placeholder="Project No." value={form.projectNo} readOnly
            className="border border-[#E4DCF0] bg-gray-50 text-gray-500 rounded px-3 py-2 w-full outline-none cursor-not-allowed" />
            
          <input placeholder="Subject (e.g. Concrete Pump Rentals)" value={form.subject}
            onChange={(e) => updateField("subject", e.target.value)}
            className="border border-[#E4DCF0] rounded px-3 py-2 w-full sm:col-span-2 md:col-span-3 focus:border-[#C4237F] outline-none" />
            
          <textarea placeholder="Proforma title, e.g. Proforma invoice for the hire of..."
            value={form.proformaTitle}
            onChange={(e) => updateField("proformaTitle", e.target.value)}
            className="border border-[#E4DCF0] rounded px-3 py-2 w-full sm:col-span-2 md:col-span-3 focus:border-[#C4237F] outline-none" rows={2} />
        </section>

        {/* Catalog, Items Table, and Terms Editor components go here... */}
        <CatalogPicker catalog={catalog} onAddItem={addItem} onAddNewCatalogItem={handleAddNewCatalogItem} />
        <ItemsTable items={items} onRemove={removeItem} onUpdate={updateItem} discPct={form.discPct} taxPct={form.taxPct} />

        {/* 3. Discount & Tax section */}
        <section className="card p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <h3 className="font-semibold text-[#3A2472] col-span-2 sm:col-span-4">Discount & tax</h3>
          <label className="text-sm font-medium text-[#241A3D]">
            Discount %
            <input type="number" value={form.discPct} onChange={(e) => updateField("discPct", parseFloat(e.target.value) || 0)}
              className="w-full border border-[#E4DCF0] rounded px-3 py-2 mt-1 focus:border-[#C4237F] outline-none" />
          </label>
          <label className="text-sm font-medium text-[#241A3D]">
            VAT %
            <input type="number" value={form.taxPct} onChange={(e) => updateField("taxPct", parseFloat(e.target.value) || 0)}
              className="w-full border border-[#E4DCF0] rounded px-3 py-2 mt-1 focus:border-[#C4237F] outline-none" />
          </label>
        </section>

        <TermsEditor terms={terms} onChange={setTerms} />

        {/* 4. Bank Selection */}
        <section className="card p-4 sm:p-5">
          <h3 className="font-semibold text-[#3A2472] mb-2">Bank account on invoice</h3>
          <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)}
            className="border border-[#E4DCF0] rounded px-3 py-2 w-full focus:border-[#C4237F] outline-none bg-white">
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>{b.bankName} — {b.accountNumber}</option>
            ))}
          </select>
        </section>

        {/* 5. Mobile-friendly full-width Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full sm:w-auto bg-gradient-to-r from-[#3A2472] to-[#C4237F] text-white font-semibold px-8 py-3.5 rounded-xl disabled:opacity-60 hover:opacity-90 transition-opacity flex justify-center items-center"
        >
          {generating ? "Generating PDF..." : "Generate Invoice"}
        </button>
      </main>
    </div>
  );
}
