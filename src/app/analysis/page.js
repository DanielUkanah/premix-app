"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Loader2, LogOut, ChevronLeft, ChevronRight, ArrowLeft, 
  TrendingUp, TrendingDown, Activity, Truck, Waves, 
  Download, FileText, Plus, Trash2, FileBarChart, X, 
  CheckSquare, Square, Info
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { VEHICLES } from "@/lib/fleet";

// COMBINED CATEGORIES FOR A SINGLE FORM
const CATEGORIES = [
  "Fuel",
  "Maintenance & Repairs",
  "Tyres",
  "Spare Parts",
  "Driver Wages / Allowance",
  "Tolls & Levies",
  "Insurance",
  "Miscellaneous",
];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Utility Helpers
function pad(n) { return String(n).padStart(2, "0"); }
function monthKey(year, month) { return `${year}-${pad(month + 1)}`; }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtMoney(n) {
  return "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

function formatDateNG(dbDate) {
  if (!dbDate || !dbDate.includes("-")) return dbDate;
  const [year, month, day] = dbDate.split("-");
  return `${day}-${month}-${year}`;
}

function VehicleIcon({ type, ...props }) {
  return type === "pump" ? <Waves {...props} /> : <Truck {...props} />;
}

// Custom script loader hook for dynamic JS exporting
function useJsPDF() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.jspdf && window.jspdf.jsPDF) { setReady(true); return; }
    const s1 = document.createElement("script");
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
      s2.onload = () => setReady(true);
      document.body.appendChild(s2);
    };
    document.body.appendChild(s1);
  }, []);
  return ready;
}

export default function FleetFinanceTracker() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fetchingData, setFetchingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [activeInfoTransaction, setActiveInfoTransaction] = useState(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [fleetStats, setFleetStats] = useState([]);
  const [globalTotals, setGlobalTotals] = useState({ rev: 0, exp: 0, net: 0 });
  const [generalRevenue, setGeneralRevenue] = useState({ amount: 0, sources: [] });
  const [historyModal, setHistoryModal] = useState(null); // 'revenue' | 'expenses' | 'net' | null
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // Authentication Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push("/login");
      else setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Main Data fetch and sync pipeline
  const fetchAnalysisData = useCallback(async () => {
    if (loading) return;
    setFetchingData(true);
    try {
      const monthPrefix = `${year}-${pad(month + 1)}`;
      
      const statsMap = {};
      VEHICLES.forEach(v => {
        statsMap[v.id] = { ...v, rev: 0, exp: 0, net: 0, invSources: [], expSources: [] };
      });

      const invSnapshot = await getDocs(collection(db, "invoices"));
      const monthlyInvoices = invSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(inv => inv.date && inv.date.startsWith(monthPrefix));

      let unassignedRevenue = 0;
      const unassignedSources = [];

      monthlyInvoices.forEach(inv => {
        (inv.items || []).forEach(item => {
          let matchedVehicle = VEHICLES.find(v => v.id === item.id);
          
          if (!matchedVehicle) {
            matchedVehicle = VEHICLES.find(v => {
              const cleanTruckName = v.name.split(' (')[0].toLowerCase().trim();
              const cleanTruckNumber = v.id.replace(/\D/g, "");
              const itemName = (item.name || "").toLowerCase();
              const itemDesc = (item.description || "").toLowerCase();

              const matchesName = itemName.includes(cleanTruckName) || itemDesc.includes(cleanTruckName);
              const isMobOrDemob = itemName.includes("mob") || itemName.includes("mobil") || itemDesc.includes("mob") || itemDesc.includes("mobil");
              const mentionsNumber = cleanTruckNumber && (itemName.includes(cleanTruckNumber) || itemDesc.includes(cleanTruckNumber));

              return matchesName || (isMobOrDemob && mentionsNumber);
            });
          }

          const price = Number(item.price || item.rate || 0);
          const days = Number(item.days || item.qty || item.quantity || 1);
          const amt = Number(item.total || item.amount || (price * days) || 0);
          if (amt <= 0) return;

          const isMobItem = (item.name || "").toLowerCase().includes("mob") || (item.name || "").toLowerCase().includes("mobil");
          const displayCategory = isMobItem ? "Mob / Demob" : "Job Revenue";
          const desc = item.name || item.description || inv.subject || `Invoice #${inv.number || 'N/A'}`;
          const customer = inv.customerName || "Bostine Logistics";

          if (matchedVehicle && statsMap[matchedVehicle.id]) {
            statsMap[matchedVehicle.id].rev += amt;
            statsMap[matchedVehicle.id].invSources.push({ date: inv.date, desc, category: displayCategory, customer, amount: amt });
          } else {
            // Not tied to a specific truck (e.g. a job-wide Mobilization/Demobilization
            // fee) — still counts toward company-wide revenue instead of being dropped.
            unassignedRevenue += amt;
            unassignedSources.push({ date: inv.date, desc, category: displayCategory, customer, amount: amt, vehicleName: "General / Mobilization" });
          }
        });
      });
      
      const expSnapshot = await getDocs(collection(db, "fleet_data"));
      expSnapshot.docs.forEach(docSnap => {
        if (docSnap.id.includes(monthPrefix)) {
          let matchedVehicle = VEHICLES.find(v => docSnap.id.includes(v.id));
          if (!matchedVehicle) {
            matchedVehicle = VEHICLES.find(v => {
              const cleanName = v.name.split(' (')[0].toLowerCase().trim().replace(/\s+/g, '-');
              const cleanDocId = docSnap.id.toLowerCase().replace(/\s+/g, '-');
              return cleanDocId.includes(cleanName);
            });
          }

          if (matchedVehicle && statsMap[matchedVehicle.id]) {
            const entries = docSnap.data().entries || [];
            entries.forEach(e => {
              const amt = Number(e.amount || 0);
              if (amt > 0) {
                statsMap[matchedVehicle.id].exp += amt;
                statsMap[matchedVehicle.id].expSources.push({ 
                  id: e.id || uid(),
                  date: e.date || monthPrefix, 
                  category: e.category || "General",
                  desc: e.description || e.category || "Expense", 
                  amount: amt 
                });
              }
            });
          }
        }
      });

      let totalRev = 0;
      let totalExp = 0;
      const finalStats = Object.values(statsMap).map(s => {
        s.net = s.rev - s.exp;
        totalRev += s.rev;
        totalExp += s.exp;
        return s;
      });
      totalRev += unassignedRevenue;

      setGlobalTotals({ rev: totalRev, exp: totalExp, net: totalRev - totalExp });
      setGeneralRevenue({ amount: unassignedRevenue, sources: unassignedSources });
      setFleetStats(finalStats);

    } catch (error) {
      console.error("Failed to sync analysis layout:", error);
    } finally {
      setFetchingData(false);
    }
  }, [month, year, loading]);

  useEffect(() => {
    fetchAnalysisData();
  }, [fetchAnalysisData]);

  const saveExpenses = async (vehicleId, nextEntries) => {
    setSaving(true);
    const storageKey = `expenses-${vehicleId}-${monthKey(year, month)}`;
    try {
      const docRef = doc(db, "fleet_data", storageKey);
      await setDoc(docRef, { entries: nextEntries }, { merge: true });
      await fetchAnalysisData();
    } catch (error) {
      alert("Failed to save changes to the database! Please check your network connection.");
    } finally {
      setSaving(false);
    }
  };

  const addExpenseEntry = async (vehicleId, currentList, entry) => {
    const newEntry = { id: uid(), ...entry };
    const updated = [...currentList, newEntry];
    await saveExpenses(vehicleId, updated.map(e => ({ date: e.date, category: e.category, description: e.desc, amount: e.amount })));
  };

  const deleteExpenseEntry = async (vehicleId, currentList, entryId) => {
    const updated = currentList.filter(e => e.id !== entryId);
    await saveExpenses(vehicleId, updated.map(e => ({ date: e.date, category: e.category, description: e.desc, amount: e.amount })));
  };

  function changeMonth(delta) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m); setYear(y);
    setSelectedVehicleId(null);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f7f5fa]"><Loader2 size={32} className="animate-spin text-brand-purple" /></div>;
  }

  const selectedVehicle = selectedVehicleId ? fleetStats.find(v => v.id === selectedVehicleId) : null;
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="min-h-screen bg-[#f7f5fa] font-sans pb-12 px-3 sm:px-6">
      <div className="max-w-5xl mx-auto mt-3 sm:mt-4 animate-in fade-in duration-200">
        
        <div className="brand-diagonal text-white px-4 py-4 sm:px-6 sm:py-5 rounded-t-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="font-medium text-[17px] sm:text-[20px] tracking-tight m-0 truncate">
              {selectedVehicle ? `${selectedVehicle.name}` : "Premix TrustConcrete"}
            </h1>
            <span className="text-[12px] sm:text-[13px] text-white/75 font-normal">
              {selectedVehicle ? "Dashboard → Vehicle Detail" : "Dashboard → Fleet Overview"}
            </span>
          </div>
          <div className="flex flex-row items-center gap-2 sm:gap-3 w-full md:w-auto justify-between md:justify-end">
            {!selectedVehicle && (
              <button 
                onClick={() => setExportOpen(true)} 
                className="flex items-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md px-2.5 py-1.5 sm:px-3 text-[13px] sm:text-sm font-medium transition-all text-white cursor-pointer"
              >
                <FileBarChart size={14} className="sm:hidden" /><FileBarChart size={15} className="hidden sm:block" /> 
                <span className="hidden xs:inline">Export Reports</span>
                <span className="xs:hidden">Export</span>
              </button>
            )}
            <button 
              onClick={() => signOut(auth)} 
              className="flex items-center gap-1.5 sm:gap-2 text-white/90 hover:text-white text-[13px] sm:text-sm font-medium bg-transparent border-none cursor-pointer p-0 transition-colors"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>

        <main className="mt-4 sm:mt-6">
          
          <div className="sticky top-2 z-20 flex items-center justify-between gap-3 bg-white/95 backdrop-blur border border-[#e7e1ef] rounded-xl p-2.5 sm:p-3 mb-5 sm:mb-6 shadow-sm">
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={() => changeMonth(-1)} className="p-1.5 sm:p-2 hover:bg-[#fafafa] rounded-lg text-brand-purple transition-colors"><ChevronLeft size={18}/></button>
              <span className="font-semibold text-[#1f1230] text-[13px] sm:text-base min-w-[100px] sm:min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
              <button onClick={() => changeMonth(1)} className="p-1.5 sm:p-2 hover:bg-[#fafafa] rounded-lg text-brand-purple transition-colors"><ChevronRight size={18}/></button>
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="hidden sm:block border border-[#e7e1ef] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-magenta bg-white">
                {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-[#e7e1ef] rounded-lg px-2 py-1 sm:py-1.5 text-[12px] sm:text-sm outline-none focus:border-brand-magenta bg-white">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {fetchingData && <Loader2 size={15} className="animate-spin text-brand-magenta ml-1" />}
            </div>
          </div>

          {selectedVehicle ? (
            <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
              
              <div className="bg-white border border-[#e7e1ef] rounded-2xl p-4 sm:p-8 shadow-sm">
                <button onClick={() => setSelectedVehicleId(null)} className="flex items-center gap-2 text-[#6f6480] hover:text-brand-purple font-medium text-sm mb-5 sm:mb-6 transition-colors">
                  <ArrowLeft size={16} /> Back to Fleet Overview
                </button>
                
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                  <VehicleIcon type={selectedVehicle.type} size={28} className="text-brand-magenta shrink-0 sm:hidden" />
                  <VehicleIcon type={selectedVehicle.type} size={32} className="text-brand-magenta shrink-0 hidden sm:block" />
                  <h2 className="text-xl sm:text-2xl font-bold text-[#1f1230]">{selectedVehicle.name}</h2>
                </div>

                {/* Mobile: gradient hero + two pills */}
                <div className="sm:hidden space-y-3 mb-6">
                  <div className={`rounded-2xl p-5 text-white shadow-sm relative overflow-hidden ${selectedVehicle.net >= 0 ? 'brand-diagonal' : 'bg-[#7a1f1f]'}`}>
                    <div className="flex items-center gap-2 text-white/80 text-[11px] font-semibold uppercase tracking-wider mb-1">
                      <Activity size={13} /> Net Profit
                    </div>
                    <div className="text-3xl font-bold">{selectedVehicle.net >= 0 ? '+' : ''}{fmtMoney(selectedVehicle.net)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="card-stat p-4">
                      <div className="card-label">REVENUE</div>
                      <div className="text-base font-bold text-[#1f1230]">{fmtMoney(selectedVehicle.rev)}</div>
                    </div>
                    <div className="card-stat p-4">
                      <div className="card-label">EXPENSES</div>
                      <div className="text-base font-bold text-[#1f1230]">{fmtMoney(selectedVehicle.exp)}</div>
                    </div>
                  </div>
                </div>

                {/* Desktop: 3-up grid */}
                <div className="hidden sm:grid grid-cols-3 gap-4 mb-8">
                  <div className="card-stat p-5">
                    <div className="card-label">GENERATED REVENUE</div>
                    <div className="card-number">{fmtMoney(selectedVehicle.rev)}</div>
                  </div>
                  <div className="card-stat p-5">
                    <div className="card-label">TOTAL EXPENSES</div>
                    <div className="card-number">{fmtMoney(selectedVehicle.exp)}</div>
                  </div>
                  <div className={`p-5 ${selectedVehicle.net >= 0 ? 'card-profit-positive' : 'card-profit-negative'}`}>
                    <div className="card-label">NET PROFIT</div>
                    <div className="card-number">
                      {selectedVehicle.net >= 0 ? '+' : ''}{fmtMoney(selectedVehicle.net)}
                    </div>
                  </div>
                </div>

                {/* THE UNIFIED EXPENSE FORM */}
                <div className="mb-8">
                  <AddExpenseForm 
                    defaultDate={year === now.getFullYear() && month === now.getMonth() ? todayStr() : `${year}-${pad(month + 1)}-01`}
                    onAdd={(entry) => addExpenseEntry(selectedVehicle.id, selectedVehicle.expSources, entry)}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                  
                  {/* Revenue Table */}
                  <div>
                    <h3 className="text-[#1f1230] font-semibold mb-4 border-b border-[#e7e1ef] pb-2 flex items-center gap-2">
                      <TrendingUp size={16} className="text-stat-positive" /> Income Sources ({selectedVehicle.invSources.length})
                    </h3>
                    {selectedVehicle.invSources.length === 0 ? (
                      <p className="text-[#6f6480] text-sm">No invoices recorded for this month.</p>
                    ) : (
                      <ul className="space-y-3">
                        {selectedVehicle.invSources.map((src, i) => (
                          <li 
                            key={i} 
                            onClick={() => setActiveInfoTransaction({ ...src, type: "Revenue" })}
                            className="flex justify-between items-start gap-3 text-sm p-3 bg-white hover:bg-[#fafafa] rounded-lg border border-[#e7e1ef] cursor-pointer hover:border-brand-magenta transition-all"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-[#1f1230] truncate">{src.customer}</div>
                              <div className="text-xs text-[#6f6480] mt-0.5 truncate">{src.desc} &bull; {formatDateNG(src.date)}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="font-semibold text-brand-purple whitespace-nowrap">{fmtMoney(src.amount)}</div>
                              <Info size={14} className="text-[#6f6480]/40 group-hover:text-brand-magenta hidden sm:block" />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Unified Expenses Ledger */}
                  <div>
                    <div className="flex justify-between items-center mb-4 border-b border-[#e7e1ef] pb-2">
                      <h3 className="text-[#1f1230] font-semibold flex items-center gap-2">
                        <TrendingDown size={16} className="text-stat-negative" /> Expense Logs ({selectedVehicle.expSources.length})
                      </h3>
                      {saving && <Loader2 size={14} className="animate-spin text-brand-magenta" />}
                    </div>
                    {selectedVehicle.expSources.length === 0 ? (
                      <p className="text-[#6f6480] text-sm">No expenses logged for this month.</p>
                    ) : (
                      <ul className="space-y-3">
                        {selectedVehicle.expSources.map((src, i) => (
                          <li 
                            key={src.id || i} 
                            className="flex justify-between items-start gap-3 text-sm p-3 bg-white hover:bg-[#fafafa] rounded-lg border border-[#e7e1ef] transition-all"
                          >
                            <div 
                              onClick={() => setActiveInfoTransaction({ ...src, type: "Expense", customer: "Mechanic / Vendor" })}
                              className="cursor-pointer flex-1 min-w-0"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`${["Maintenance & Repairs", "Tyres", "Spare Parts"].includes(src.category) ? 'bg-[#f7f5fa] text-brand-purple border border-[#e7e1ef]' : 'pill-badge-negative'} px-2 py-0.5 rounded-full text-[10px] uppercase font-bold`}>{src.category}</span>
                                <span className="font-medium text-[#1f1230] capitalize truncate">{src.desc}</span>
                              </div>
                              <div className="text-xs text-[#6f6480] mt-1.5">{formatDateNG(src.date)}</div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                              <span className="font-semibold text-brand-magenta whitespace-nowrap">{fmtMoney(src.amount)}</span>
                              <button 
                                onClick={() => deleteExpenseEntry(selectedVehicle.id, selectedVehicle.expSources, src.id)} 
                                className="background-none border-none cursor-pointer text-stat-negative hover:opacity-80 transition-opacity"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                </div>
              </div>
            </div>

          ) : (
            <div className="space-y-7 sm:space-y-8 animate-in fade-in duration-300">
              
              {/* Mobile: gradient hero net profit + two pills */}
              <div className="sm:hidden space-y-3">
                <button
                  onClick={() => setHistoryModal('net')}
                  className={`w-full text-left rounded-2xl p-5 text-white shadow-sm relative overflow-hidden active:scale-[0.98] transition-transform ${globalTotals.net >= 0 ? 'brand-diagonal' : 'bg-[#7a1f1f]'}`}
                >
                  <div className="flex items-center gap-2 text-white/80 text-[11px] font-semibold uppercase tracking-wider mb-1">
                    <Activity size={13} /> Net Profit &bull; {MONTH_NAMES[month]} {year}
                  </div>
                  <div className="text-3xl font-bold">{globalTotals.net >= 0 ? '+' : ''}{fmtMoney(globalTotals.net)}</div>
                  <div className="text-[11px] text-white/60 mt-1">Tap for breakdown</div>
                  <svg width="90" height="90" viewBox="0 0 90 90" className="absolute -top-4 -right-4 opacity-10">
                    <polygon points="90,0 90,90 0,0" fill="#fff" />
                  </svg>
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setHistoryModal('revenue')} className="card-stat p-4 text-left active:scale-[0.98] transition-transform">
                    <div className="flex items-center gap-1.5 text-[#6f6480] text-[10px] font-semibold uppercase tracking-wide mb-1">
                      <TrendingUp size={12} className="text-brand-purple" /> Revenue
                    </div>
                    <div className="text-base font-bold text-brand-purple">{fmtMoney(globalTotals.rev)}</div>
                  </button>
                  <button onClick={() => setHistoryModal('expenses')} className="card-stat p-4 text-left active:scale-[0.98] transition-transform">
                    <div className="flex items-center gap-1.5 text-[#6f6480] text-[10px] font-semibold uppercase tracking-wide mb-1">
                      <TrendingDown size={12} className="text-brand-magenta" /> Expenses
                    </div>
                    <div className="text-base font-bold text-brand-magenta">{fmtMoney(globalTotals.exp)}</div>
                  </button>
                </div>
              </div>

              {/* Desktop: 3-up grid */}
              <div className="hidden sm:grid grid-cols-3 gap-4">
                <button onClick={() => setHistoryModal('revenue')} className="card-stat p-6 flex flex-col justify-center text-left hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 text-[#6f6480] text-sm font-semibold uppercase tracking-wider mb-2">
                    <TrendingUp size={16} className="text-brand-purple" /> Total Revenue
                  </div>
                  <div className="card-number text-brand-purple">{fmtMoney(globalTotals.rev)}</div>
                </button>
                
                <button onClick={() => setHistoryModal('expenses')} className="card-stat p-6 flex flex-col justify-center text-left hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 text-[#6f6480] text-sm font-semibold uppercase tracking-wider mb-2">
                    <TrendingDown size={16} className="text-brand-magenta" /> Total Expenses
                  </div>
                  <div className="card-number text-brand-magenta">{fmtMoney(globalTotals.exp)}</div>
                </button>
                
                <button onClick={() => setHistoryModal('net')} className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-center text-left hover:shadow-md transition-shadow ${globalTotals.net >= 0 ? 'card-profit-positive' : 'card-profit-negative'}`}>
                  <div className="flex items-center gap-2 text-[#6f6480] text-sm font-semibold uppercase tracking-wider mb-2">
                    <Activity size={16} className={globalTotals.net >= 0 ? 'text-stat-positive' : 'text-stat-negative'} /> Net Profit
                  </div>
                  <div className="card-number">
                    {globalTotals.net >= 0 ? '+' : ''} {fmtMoney(globalTotals.net)}
                  </div>
                </button>
              </div>

              {['mixer', 'pump', 'excavator'].map(type => {
                const groupStats = fleetStats.filter(v => v.type === type);
                if (groupStats.length === 0) return null;

                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <h3 className="section-header m-0">{type}s Performance</h3>
                      <span className="text-[11px] text-[#a89bb8] font-medium sm:hidden">swipe &rarr;</span>
                    </div>

                    {/* Mobile: horizontal scroll-snap carousel */}
                    <div className="flex sm:hidden gap-3 overflow-x-auto pb-2 -mx-3 px-3 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {groupStats.map(v => (
                        <div key={v.id} className="min-w-[76%] snap-start">
                          <VehicleCard v={v} onClick={() => setSelectedVehicleId(v.id)} />
                        </div>
                      ))}
                    </div>

                    {/* Desktop/tablet: grid */}
                    <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {groupStats.map(v => (
                        <VehicleCard key={v.id} v={v} onClick={() => setSelectedVehicleId(v.id)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
      
      {exportOpen && <ExportPanel onClose={() => setExportOpen(false)} />}

      {historyModal && (
        <HistoryModal
          type={historyModal}
          month={month}
          year={year}
          fleetStats={fleetStats}
          generalRevenue={generalRevenue}
          globalTotals={globalTotals}
          onClose={() => setHistoryModal(null)}
        />
      )}

      {activeInfoTransaction && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#e7e1ef] rounded-2xl w-full max-w-sm p-5 sm:p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className={`pill-badge ${activeInfoTransaction.type === 'Revenue' ? 'pill-badge-positive' : 'pill-badge-negative'} text-[10px] uppercase font-bold tracking-wider mb-2`}>
                  {activeInfoTransaction.type}
                </span>
                <h3 className="text-lg font-bold text-[#1f1230] mt-1">Transaction Details</h3>
              </div>
              <button 
                onClick={() => setActiveInfoTransaction(null)} 
                className="p-1 hover:bg-[#f7f5fa] rounded-full transition-colors text-[#6f6480] hover:text-[#1f1230]"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4 text-sm border-t border-[#e7e1ef] pt-4">
              <div>
                <span className="block text-xs text-[#6f6480] font-medium">Source / Payee</span>
                <span className="text-[#1f1230] font-semibold">{activeInfoTransaction.customer || "Bostine Logistics"}</span>
              </div>
              <div>
                <span className="block text-xs text-[#6f6480] font-medium">Category</span>
                <span className="text-[#1f1230] font-semibold">{activeInfoTransaction.category}</span>
              </div>
              <div>
                <span className="block text-xs text-[#6f6480] font-medium">Description</span>
                <span className="text-[#1f1230] capitalize">{activeInfoTransaction.desc}</span>
              </div>
              <div className="flex justify-between gap-4">
                <div>
                  <span className="block text-xs text-[#6f6480] font-medium">Date</span>
                  <span className="text-[#1f1230]">{formatDateNG(activeInfoTransaction.date)}</span>
                </div>
                <div className="text-right">
                  <span className="block text-xs text-[#6f6480] font-medium">Transaction Value</span>
                  <span className={`font-bold text-base ${activeInfoTransaction.type === 'Revenue' ? 'text-stat-positive' : 'text-stat-negative'}`}>
                    {fmtMoney(activeInfoTransaction.amount)}
                  </span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setActiveInfoTransaction(null)} 
              className="btn-primary w-full mt-6 flex justify-center items-center"
            >
              Close Info
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// SINGLE MIXER/VEHICLE CARD — used in both the mobile carousel and desktop grid
function VehicleCard({ v, onClick }) {
  const isActive = v.rev > 0 || v.exp > 0;
  const total = v.rev + v.exp;
  const revPct = total > 0 ? (v.rev / total) * 100 : 0;
  const expPct = total > 0 ? 100 - revPct : 0;

  return (
    <div 
      onClick={onClick}
      className={`bg-white border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between h-full border-l-4 ${isActive ? 'border-l-brand-magenta border-t-[#e7e1ef] border-r-[#e7e1ef] border-b-[#e7e1ef] hover:border-brand-magenta' : 'border-l-[#e7e1ef] border-t-[#e7e1ef] border-r-[#e7e1ef] border-b-[#e7e1ef] hover:border-brand-magenta opacity-80'}`}
    >
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <VehicleIcon type={v.type} size={20} className="text-brand-magenta shrink-0" />
            <span className="font-semibold text-[#1f1230] text-sm truncate">{v.name}</span>
          </div>
          <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${isActive ? 'bg-[#f6d9e9] text-brand-magenta' : 'bg-[#f0ecf5] text-[#a89bb8]'}`}>
            {isActive ? 'Active' : 'Idle'}
          </span>
        </div>
        
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-[#6f6480]">Rev:</span>
            <span className="font-medium text-brand-purple">{fmtMoney(v.rev)}</span>
          </div>
          <div className="flex justify-between pb-2">
            <span className="text-[#6f6480]">Outflows:</span>
            <span className="font-medium text-brand-magenta">{fmtMoney(v.exp)}</span>
          </div>
        </div>

        {total > 0 && (
          <div className="h-1.5 rounded-full bg-[#f0ecf5] overflow-hidden flex mb-2">
            <div style={{ width: `${revPct}%` }} className="bg-brand-purple h-full" />
            <div style={{ width: `${expPct}%` }} className="bg-brand-magenta h-full" />
          </div>
        )}
      </div>
      
      <div className="flex justify-between pt-2 mt-1 border-t border-[#e7e1ef]/60">
        <span className="text-[#6f6480] font-medium text-sm">Net:</span>
        <span className={`font-semibold text-sm ${v.net >= 0 ? 'text-stat-positive' : 'text-stat-negative'}`}>
          {v.net >= 0 ? '+' : ''}{fmtMoney(v.net)}
        </span>
      </div>

      <svg width="40" height="40" viewBox="0 0 60 60" className="absolute -top-2 -right-2 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
        <polygon points="60,0 60,60 0,0" fill={v.type === "pump" ? "#3A2472" : "#C4237F"} />
      </svg>
    </div>
  );
}

// Breakdown shown when a person taps Total Revenue / Total Expenses / Net Profit.
// Built entirely from data already loaded for the month — no extra fetch needed.
function HistoryModal({ type, month, year, fleetStats, generalRevenue, globalTotals, onClose }) {
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  const revenueRows = fleetStats
    .flatMap(v => v.invSources.map(s => ({ ...s, vehicleName: v.name })))
    .concat(generalRevenue.sources)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const expenseRows = fleetStats
    .flatMap(v => v.expSources.map(s => ({ ...s, vehicleName: v.name })))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const title = type === "revenue" ? "Revenue history" : type === "expenses" ? "Expense history" : "Net profit breakdown";

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
      <div className="bg-white border border-[#e7e1ef] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-[#e7e1ef] px-5 py-4 flex justify-between items-center z-10">
          <div>
            <h3 className="text-base font-bold text-[#1f1230]">{title}</h3>
            <span className="text-xs text-[#6f6480]">{monthLabel}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f7f5fa] rounded-full text-[#6f6480] hover:text-[#1f1230] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {type === "net" && (
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-[#6f6480]">Total revenue</span>
                <span className="font-semibold text-brand-purple">{fmtMoney(globalTotals.rev)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6f6480]">Total expenses</span>
                <span className="font-semibold text-brand-magenta">{fmtMoney(globalTotals.exp)}</span>
              </div>
              <div className={`flex justify-between text-base font-bold pt-2 border-t border-[#e7e1ef] ${globalTotals.net >= 0 ? 'text-stat-positive' : 'text-stat-negative'}`}>
                <span>Net profit</span>
                <span>{globalTotals.net >= 0 ? '+' : ''}{fmtMoney(globalTotals.net)}</span>
              </div>
            </div>
          )}

          {type === "revenue" && (
            revenueRows.length === 0 ? (
              <p className="text-sm text-[#6f6480] text-center py-6">No revenue recorded for {monthLabel}.</p>
            ) : (
              <ul className="space-y-2.5">
                {revenueRows.map((r, i) => (
                  <li key={i} className="border border-[#e7e1ef] rounded-lg p-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-[#1f1230] text-sm truncate">{r.vehicleName}</div>
                        <div className="text-xs text-[#6f6480] mt-0.5 truncate">{r.desc} &bull; {formatDateNG(r.date)}</div>
                      </div>
                      <span className="font-semibold text-brand-purple text-sm whitespace-nowrap shrink-0">{fmtMoney(r.amount)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}

          {type === "expenses" && (
            expenseRows.length === 0 ? (
              <p className="text-sm text-[#6f6480] text-center py-6">No expenses recorded for {monthLabel}.</p>
            ) : (
              <ul className="space-y-2.5">
                {expenseRows.map((r, i) => (
                  <li key={i} className="border border-[#e7e1ef] rounded-lg p-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-[#1f1230] text-sm truncate">{r.vehicleName}</div>
                        <div className="text-xs text-[#6f6480] mt-0.5 truncate">{r.desc} &bull; {formatDateNG(r.date)}</div>
                      </div>
                      <span className="font-semibold text-brand-magenta text-sm whitespace-nowrap shrink-0">{fmtMoney(r.amount)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// THE SINGLE COMBINED FORM
function AddExpenseForm({ defaultDate, onAdd }) {
  const [date, setDate] = useState(defaultDate);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => { setDate(defaultDate); }, [defaultDate]);

  function submit(e) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !date) return;
    onAdd({ date, category, desc: description.trim(), amount: Number(amount) });
    setDescription("");
    setAmount("");
  }

  return (
    <form onSubmit={submit} className="bg-white border border-[#e7e1ef] rounded-xl p-4 sm:p-5 shadow-sm">
      <div className="font-semibold text-sm text-[#1f1230] mb-3">Add Expense or Maintenance Entry</div>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-semibold text-[#6f6480] mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-[#e7e1ef] rounded-lg text-sm bg-white text-[#1f1230]" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#6f6480] mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-[#e7e1ef] rounded-lg text-sm bg-white text-[#1f1230]">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-semibold text-[#6f6480] mb-1">Description</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Fuel or Oil Change" className="w-full px-3 py-2 border border-[#e7e1ef] rounded-lg text-sm bg-white text-[#1f1230]" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#6f6480] mb-1">Cost (₦)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border border-[#e7e1ef] rounded-lg text-sm bg-white text-[#1f1230]" required />
        </div>
        <button type="submit" className="btn-primary flex items-center justify-center gap-2 h-[38px] w-full font-medium col-span-2 sm:col-span-2 md:col-span-1">
          <Plus size={16} /> Add log
        </button>
      </div>
    </form>
  );
}

function ExportPanel({ onClose }) {
  const jsPdfReady = useJsPDF();
  const now = new Date();
  const years = [];
  for (let y = now.getFullYear() - 3; y <= now.getFullYear() + 1; y++) years.push(y);

  const [mode, setMode] = useState("months"); 
  const [selectedIds, setSelectedIds] = useState(new Set(VEHICLES.map((v) => v.id)));
  const [monthChips, setMonthChips] = useState([{ year: now.getFullYear(), month: now.getMonth() }]);
  const [chipMonth, setChipMonth] = useState(now.getMonth());
  const [chipYear, setChipYear] = useState(now.getFullYear());
  const [yearMode, setYearMode] = useState(now.getFullYear());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  function toggleVehicle(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() { setSelectedIds((prev) => (prev.size === VEHICLES.length ? new Set() : new Set(VEHICLES.map((v) => v.id)))); }
  function addChip() {
    const exists = monthChips.some((c) => c.year === chipYear && c.month === chipMonth);
    if (exists) return;
    setMonthChips([...monthChips, { year: chipYear, month: chipMonth }].sort((a, b) => a.year - b.year || a.month - b.month));
  }
  function removeChip(idx) { setMonthChips(monthChips.filter((_, i) => i !== idx)); }
  function monthsToExport() {
    if (mode === "year") return Array.from({ length: 12 }, (_, i) => ({ year: yearMode, month: i }));
    return monthChips;
  }

  async function gatherRows() {
    const vehicles = VEHICLES.filter((v) => selectedIds.has(v.id));
    const months = monthsToExport();
    const rows = [];
    
    for (const m of months) {
      const monthPrefix = `${m.year}-${pad(m.month + 1)}`;
      
      let monthlyInvoices = [];
      try {
        const invSnapshot = await getDocs(collection(db, "invoices"));
        monthlyInvoices = invSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(inv => inv.date && inv.date.startsWith(monthPrefix));
      } catch (err) {
        console.error("Invoice gathering skipped:", err);
      }

      for (const v of vehicles) {
        monthlyInvoices.forEach(inv => {
          (inv.items || []).forEach(item => {
            let matchedVehicle = VEHICLES.find(truck => truck.id === item.id);
            if (!matchedVehicle) {
              matchedVehicle = VEHICLES.find(truck => {
                const cleanTruckName = truck.name.split(' (')[0].toLowerCase().trim();
                const itemName = (item.name || "").toLowerCase();
                const itemDesc = (item.description || "").toLowerCase();
                return itemName.includes(cleanTruckName) || itemDesc.includes(cleanTruckName);
              });
            }

            if (matchedVehicle && matchedVehicle.id === v.id) {
              const price = Number(item.price || item.rate || 0);
              const days = Number(item.days || item.qty || item.quantity || 1);
              const amt = Number(item.total || item.amount || (price * days) || 0);

              if (amt > 0) {
                rows.push({
                  vehicle: v.name,
                  monthLabel: `${MONTH_NAMES[m.month]} ${m.year}`,
                  monthSort: monthPrefix,
                  date: inv.date,
                  type: "Revenue",
                  category: "Job Revenue",
                  description: item.name || item.description || inv.subject || `Invoice #${inv.number || 'N/A'}`,
                  amount: amt
                });
              }
            }
          });
        });

        const sKey = `expenses-${v.id}-${monthPrefix}`;
        try {
          const docRef = doc(db, "fleet_data", sKey);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const entries = docSnap.data().entries || [];
            entries.forEach((e) =>
              rows.push({
                vehicle: v.name,
                monthLabel: `${MONTH_NAMES[m.month]} ${m.year}`,
                monthSort: monthPrefix,
                date: e.date || monthPrefix,
                type: "Expense",
                category: e.category || "General",
                description: e.description || e.category || "Expense",
                amount: Number(e.amount || 0)
              })
            );
          }
        } catch { /* ignore */ }
      }
    }
    return rows;
  }

  function groupByVehicle(rows) {
    const order = [];
    const map = {};
    rows.forEach((r) => {
      if (!map[r.vehicle]) { map[r.vehicle] = []; order.push(r.vehicle); }
      map[r.vehicle].push(r);
    });
    return order.map((vehicle) => ({
      vehicle,
      rows: [...map[vehicle]].sort((a, b) => a.monthSort.localeCompare(b.monthSort) || a.date.localeCompare(b.date)),
    }));
  }

  function reportLabel() {
    if (mode === "year") return `${yearMode} Annual Report`;
    if (monthChips.length === 1) return monthChips.map((c) => `${MONTH_NAMES[c.month]} ${c.year}`)[0];
    return `${monthChips.length} Month Report`;
  }

  async function handleExportCSV() {
    setBusy(true); setStatus("");
    const rows = await gatherRows();
    setBusy(false);
    
    if (rows.length === 0) { setStatus("No transactions found for that selection."); return; }
    
    const groups = groupByVehicle(rows);
    const lines = [["Vehicle", "Month", "Date", "Type", "Category", "Description", "Amount (NGN)"]];
    let grandRevenue = 0;
    let grandExpenses = 0;
    
    groups.forEach(({ vehicle, rows: list }) => {
      let subRevenue = 0;
      let subExpenses = 0;
      list.forEach((r) => {
        lines.push([vehicle, r.monthLabel, r.date, r.type, r.category, r.description || "", Number(r.amount).toFixed(2)]);
        if (r.type === "Revenue") subRevenue += Number(r.amount);
        else subExpenses += Number(r.amount);
      });
      lines.push(["", "", "", "", `${vehicle} sub-revenue`, subRevenue.toFixed(2)]);
      lines.push(["", "", "", "", `${vehicle} sub-expenses`, subExpenses.toFixed(2)]);
      lines.push(["", "", "", "", `${vehicle} net`, (subRevenue - subExpenses).toFixed(2)]);
      grandRevenue += subRevenue;
      grandExpenses += subExpenses;
    });
    
    lines.push(["", "", "", "", "GRAND REVENUE", grandRevenue.toFixed(2)]);
    lines.push(["", "", "", "", "GRAND EXPENSES", grandExpenses.toFixed(2)]);
    lines.push(["", "", "", "", "GRAND NET PROFIT", (grandRevenue - grandExpenses).toFixed(2)]);

    const csv = lines.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).toString()).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Premix_TrustConcrete_Transactions_${reportLabel().replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("CSV downloaded.");
  }

  async function handleExportPDF() {
    if (!jsPdfReady || !window.jspdf) { setStatus("PDF engine still loading..."); return; }
    
    setBusy(true); setStatus("");
    const rows = await gatherRows();
    setBusy(false);
    
    if (rows.length === 0) { setStatus("No transactions found for that selection."); return; }
    
    const groups = groupByVehicle(rows);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    
    doc.setFillColor(52, 20, 92);
    doc.rect(0, 0, 210, 36, "F");
    
    doc.setFillColor(226, 19, 122); 
    doc.rect(0, 36, 210, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("Premix TrustConcrete", 14, 16);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255, 0.8);
    doc.text(`TRANSACTION LEDGER REPORT — ${reportLabel().toUpperCase()}`, 14, 23);
    doc.text(`Generated on: ${formatDateNG(todayStr())}`, 14, 28);

    let y = 48;
    let grandRevenue = 0;
    let grandExpenses = 0;
    
    groups.forEach(({ vehicle, rows: list }) => {
      if (y > 240) { doc.addPage(); y = 20; }
      
      const vehicleRev = list.filter(r => r.type === "Revenue").reduce((s, r) => s + Number(r.amount || 0), 0);
      const vehicleExp = list.filter(r => r.type === "Expense").reduce((s, r) => s + Number(r.amount || 0), 0);
      const vehicleNet = vehicleRev - vehicleExp;

      grandRevenue += vehicleRev;
      grandExpenses += vehicleExp;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(52, 20, 92);
      doc.text(vehicle.toUpperCase(), 14, y);
      
      doc.autoTable({
        startY: y + 3,
        head: [["Date", "Type", "Category", "Description", "Amount (NGN)"]],
        body: list.map((r) => [
          formatDateNG(r.date),
          r.type.toUpperCase(),
          r.category,
          r.description || "-",
          Number(r.amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })
        ]),
        headStyles: { 
          fillColor: [52, 20, 92],
          textColor: [255, 255, 255], 
          fontSize: 8,
          fontStyle: "bold",
          cellPadding: 3
        },
        alternateRowStyles: { fillColor: [250, 249, 252] },
        bodyStyles: { 
          fontSize: 8, 
          textColor: [31, 18, 48], 
          cellPadding: 3
        },
        columnStyles: {
          4: { halign: "right" }
        },
        didParseCell: function (data) {
          if (data.column.index === 1 && data.section === "body") {
            if (data.cell.raw === "REVENUE") {
              data.cell.styles.textColor = [59, 109, 17];
              data.cell.styles.fillColor = [234, 243, 222]; 
            } else if (data.cell.raw === "EXPENSE") {
              data.cell.styles.textColor = [155, 28, 28];
              data.cell.styles.fillColor = [253, 232, 232];
            }
          }
        },
        margin: { left: 14, right: 14 },
      });
      
      y = doc.lastAutoTable.finalY + 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(111, 100, 128);
      doc.text(`Revenue: ${fmtMoney(vehicleRev)}   |   Expenses: ${fmtMoney(vehicleExp)}`, 14, y);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(vehicleNet >= 0 ? 59 : 155, vehicleNet >= 0 ? 109 : 28, vehicleNet >= 0 ? 17 : 28);
      doc.text(`Net Profit: ${fmtMoney(vehicleNet)}`, 120, y);
      
      y += 12;
    });
    
    if (y > 230) { doc.addPage(); y = 25; }
    
    const grandNet = grandRevenue - grandExpenses;
    
    doc.setDrawColor(231, 225, 239);
    doc.line(14, y, 196, y);
    
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(52, 20, 92);
    doc.text("COMPANY-WIDE FINANCIAL SUMMARY", 14, y);
    
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(31, 18, 48);
    doc.text(`Total Generated Revenue: ${fmtMoney(grandRevenue)}`, 14, y);
    
    y += 5;
    doc.text(`Total Logged Expenses: ${fmtMoney(grandExpenses)}`, 14, y);
    
    y += 6;
    doc.setFillColor(grandNet >= 0 ? 234 : 253, grandNet >= 0 ? 243 : 232, grandNet >= 0 ? 222 : 232);
    doc.roundedRect(14, y, 182, 12, 2, 2, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(grandNet >= 0 ? 59 : 155, grandNet >= 0 ? 109 : 28, grandNet >= 0 ? 17 : 28);
    doc.text(`NET FINANCIAL STANDING:   ${grandNet >= 0 ? '+' : ''}${fmtMoney(grandNet)}`, 18, y + 8);
    
    doc.save(`Premix_TrustConcrete_Transactions_${reportLabel().replace(/\s+/g, "_")}.pdf`);
    setStatus("PDF downloaded.");
  }

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 border border-[#e7e1ef]">
        
        <div className="flex justify-between items-center">
          <h2 className="text-base sm:text-lg font-semibold text-[#1f1230]">Export Multi-Month Transactions</h2>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-[#6f6480] hover:text-[#1f1230]"><X size={20} /></button>
        </div>
        <p className="text-[#6f6480] text-[13px] sm:text-sm -mt-2">Select any vehicles and active months to compile a custom multi-month financial ledger (includes Revenue and Expenses).</p>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-bold tracking-wider text-brand-purple uppercase">VEHICLES</span>
            <button onClick={toggleAll} className="flex items-center gap-1.5 text-brand-magenta text-xs font-semibold bg-transparent border-none cursor-pointer">
              {selectedIds.size === VEHICLES.length ? <CheckSquare size={14} /> : <Square size={14} />} Select all
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {VEHICLES.map((v) => {
              const on = selectedIds.has(v.id);
              return (
                <button
                  key={v.id}
                  onClick={() => toggleVehicle(v.id)}
                  className={`flex items-center gap-2 p-2 border rounded-lg text-xs font-semibold cursor-pointer text-left transition-colors ${on ? 'border-brand-magenta bg-[#f6d9e9] text-brand-magenta' : 'border-[#e7e1ef] bg-white text-[#6f6480]'}`}
                >
                  {on ? <CheckSquare size={14} /> : <Square size={14} />} {v.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 border-b border-[#e7e1ef] pb-3">
          <button onClick={() => setMode("months")} className={`flex-1 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${mode === "months" ? 'border-brand-magenta bg-[#f6d9e9] text-brand-magenta' : 'border-[#e7e1ef] bg-white text-[#6f6480]'}`}>Pick specific months</button>
          <button onClick={() => setMode("year")} className={`flex-1 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${mode === "year" ? 'border-brand-magenta bg-[#f6d9e9] text-brand-magenta' : 'border-[#e7e1ef] bg-white text-[#6f6480]'}`}>Full year</button>
        </div>

        {mode === "months" ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="flex gap-2">
                <select value={chipMonth} onChange={(e) => setChipMonth(Number(e.target.value))} className="flex-1 px-3 py-2 border border-[#e7e1ef] rounded-lg text-sm bg-white text-[#1f1230]">
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select value={chipYear} onChange={(e) => setChipYear(Number(e.target.value))} className="flex-1 px-3 py-2 border border-[#e7e1ef] rounded-lg text-sm bg-white text-[#1f1230]">
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={addChip} className="btn-secondary flex items-center justify-center gap-1.5 h-[38px]"><Plus size={14} /> Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {monthChips.length === 0 && <div className="text-xs text-[#6f6480]">No active months included yet.</div>}
              {monthChips.map((c, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#f7f5fa] border border-[#e7e1ef] rounded-full px-3 py-1 text-xs text-brand-purple font-semibold">
                  {MONTH_NAMES[c.month]} {c.year}
                  <button onClick={() => removeChip(i)} className="bg-transparent border-none cursor-pointer text-brand-purple hover:text-brand-magenta flex"><X size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <span className="block text-xs text-[#6f6480] mb-2">Select full year (Jan - Dec)</span>
            <select value={yearMode} onChange={(e) => setYearMode(Number(e.target.value))} className="w-full px-3 py-2 border border-[#e7e1ef] rounded-lg text-sm bg-white text-[#1f1230]">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {status && <div className="text-xs font-medium text-brand-magenta">{status}</div>}

        <div className="flex gap-2 justify-end pt-2 border-t border-[#e7e1ef]">
          <button 
            onClick={handleExportCSV} 
            disabled={busy || selectedIds.size === 0 || (mode === "months" && monthChips.length === 0)} 
            className="btn-secondary flex items-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} CSV
          </button>
          <button 
            onClick={handleExportPDF} 
            disabled={busy || !jsPdfReady || selectedIds.size === 0 || (mode === "months" && monthChips.length === 0)} 
            className="btn-primary flex items-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} PDF
          </button>
        </div>
      </div>
    </div>
  );
}