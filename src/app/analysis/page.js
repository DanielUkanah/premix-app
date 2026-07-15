"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, ChevronLeft, ChevronRight, ArrowLeft, TrendingUp, TrendingDown, Activity, Truck, Waves } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { VEHICLES } from "@/lib/fleet";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Money Formatter
function fmtMoney(n) {
  return "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Date Formatter: Flips YYYY-MM-DD to standard Nigerian DD-MM-YYYY for display
function formatDateNG(dbDate) {
  if (!dbDate || !dbDate.includes("-")) return dbDate;
  const [year, month, day] = dbDate.split("-");
  return `${day}-${month}-${year}`;
}

function VehicleIcon({ type, ...props }) {
  return type === "pump" ? <Waves {...props} /> : <Truck {...props} />;
}

export default function AnalysisDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fetchingData, setFetchingData] = useState(false);
  
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [fleetStats, setFleetStats] = useState([]);
  const [globalTotals, setGlobalTotals] = useState({ rev: 0, exp: 0, net: 0 });
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // Authentication Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push("/login");
      else setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Data Engine: Fetches and calculates everything when the month/year changes
  useEffect(() => {
    if (loading) return;
    
    async function fetchAnalysisData() {
      setFetchingData(true);
      try {
        const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`; // e.g., "2026-07"
        
        // 1. Initialize stats buckets for all vehicles
        const statsMap = {};
        VEHICLES.forEach(v => {
          statsMap[v.id] = { ...v, rev: 0, exp: 0, net: 0, invSources: [], expSources: [] };
        });

        // 2. Fetch all Invoices and filter by the selected month
        const invSnapshot = await getDocs(collection(db, "invoices"));
        const monthlyInvoices = invSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(inv => inv.date && inv.date.startsWith(monthPrefix));

// Aggregate Revenue into buckets
        monthlyInvoices.forEach(inv => {
          (inv.items || []).forEach(item => {
            
            // 1. Try exact ID match first
            let matchedVehicle = VEHICLES.find(v => v.id === item.id);
            
            // 2. If no exact match, try matching the text (ignoring brackets like "(Gift)")
            if (!matchedVehicle) {
              matchedVehicle = VEHICLES.find(v => {
                const cleanTruckName = v.name.split(' (')[0].toLowerCase().trim();
                const itemName = (item.name || "").toLowerCase();
                const itemDesc = (item.description || "").toLowerCase();
                return itemName.includes(cleanTruckName) || itemDesc.includes(cleanTruckName);
              });
            }

            // 3. Add the money to the matched vehicle bucket
            if (matchedVehicle && statsMap[matchedVehicle.id]) {
              // Automatically calculate total if database only saved price and days
              const price = Number(item.price || item.rate || 0);
              const days = Number(item.days || item.qty || item.quantity || 1);
              const amt = Number(item.total || item.amount || (price * days) || 0);

              if (amt > 0) {
                statsMap[matchedVehicle.id].rev += amt;
                statsMap[matchedVehicle.id].invSources.push({ 
                  date: inv.date, 
                  desc: item.name || item.description || inv.subject || `Invoice #${inv.number || 'N/A'}`, 
                  customer: inv.customerName,
                  amount: amt 
                });
              }
            }
          });
        });
        // 3. Fetch Expenses for all vehicles for this month (SMART SEARCH)
        const expSnapshot = await getDocs(collection(db, "fleet_data"));
        
        expSnapshot.docs.forEach(docSnap => {
          // Ensure the document belongs to this month (e.g., "2026-07")
          if (docSnap.id.includes(monthPrefix)) {
            
            // 1. Try to match the document ID to a vehicle ID first
            let matchedVehicle = VEHICLES.find(v => docSnap.id.includes(v.id));
            
            // 2. If it fails, try matching the vehicle name (ignoring brackets and spaces)
            if (!matchedVehicle) {
              matchedVehicle = VEHICLES.find(v => {
                const cleanName = v.name.split(' (')[0].toLowerCase().trim().replace(/\s+/g, '-');
                const cleanDocId = docSnap.id.toLowerCase().replace(/\s+/g, '-');
                return cleanDocId.includes(cleanName);
              });
            }

            // 3. Add the expenses to the matched vehicle bucket
            if (matchedVehicle && statsMap[matchedVehicle.id]) {
              const entries = docSnap.data().entries || [];
              entries.forEach(e => {
                const amt = Number(e.amount || 0);
                if (amt > 0) {
                  statsMap[matchedVehicle.id].exp += amt;
                  statsMap[matchedVehicle.id].expSources.push({ 
                    date: e.date || monthPrefix, 
                    desc: e.description || e.category || "Expense", 
                    amount: amt 
                  });
                }
              });
            }
          }
        });
        // 4. Calculate Nets and Global Totals
        let totalRev = 0;
        let totalExp = 0;
        const finalStats = Object.values(statsMap).map(s => {
          s.net = s.rev - s.exp;
          totalRev += s.rev;
          totalExp += s.exp;
          return s;
        });

        setGlobalTotals({ rev: totalRev, exp: totalExp, net: totalRev - totalExp });
        setFleetStats(finalStats);

      } catch (error) {
        console.error("Failed to fetch analysis data:", error);
      } finally {
        setFetchingData(false);
      }
    }

    fetchAnalysisData();
  }, [month, year, loading]);

  function changeMonth(delta) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m); setYear(y);
    setSelectedVehicleId(null); // Reset drill-down if month changes
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FDFBFD]"><Loader2 size={32} className="animate-spin text-[#3A2472]" /></div>;
  }

  const selectedVehicle = selectedVehicleId ? fleetStats.find(v => v.id === selectedVehicleId) : null;
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="min-h-screen bg-[#FDFBFD] font-sans pb-12">
      {/* Sleek Gradient Header */}
      <div className="bg-gradient-to-r from-[#3A2472] to-[#C4237F] text-white px-4 sm:px-6 py-4 shadow-md w-full">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-semibold text-lg sm:text-[20px] tracking-tight m-0">Premix TrustConcrete — Analysis</h1>
            <div className="text-[13px] text-white/80 mt-1">Dashboard &rarr; Performance Analytics</div>
          </div>
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium bg-transparent border-none cursor-pointer p-0">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 mt-4">
        
        {/* Month/Year Filter Control */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-[#E4DCF0] rounded-xl p-3 mb-6 shadow-sm">
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-[#F5F1FA] rounded-lg text-[#3A2472] transition-colors"><ChevronLeft size={20}/></button>
            <span className="font-semibold text-[#241A3D] min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-[#F5F1FA] rounded-lg text-[#3A2472] transition-colors"><ChevronRight size={20}/></button>
          </div>
          
          <div className="flex items-center gap-2">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border border-[#E4DCF0] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#C4237F]">
              {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-[#E4DCF0] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#C4237F]">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {fetchingData && <Loader2 size={16} className="animate-spin text-[#C4237F] ml-2" />}
          </div>
        </div>

        {/* View Router: Show Drill-down OR Full Dashboard */}
        {selectedVehicle ? (
          /* --- MICRO VIEW: SINGLE VEHICLE DRILL-DOWN --- */
          <div className="bg-white border border-[#E4DCF0] rounded-2xl p-5 sm:p-8 shadow-sm">
            <button onClick={() => setSelectedVehicleId(null)} className="flex items-center gap-2 text-[#8B7FA8] hover:text-[#3A2472] font-medium text-sm mb-6 transition-colors">
              <ArrowLeft size={16} /> Back to Fleet Overview
            </button>
            
            <div className="flex items-center gap-3 mb-8">
              <VehicleIcon type={selectedVehicle.type} size={32} className="text-[#C4237F]" />
              <h2 className="text-2xl font-bold text-[#241A3D]">{selectedVehicle.name}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-[#F5F1FA] p-4 rounded-xl border border-[#E4DCF0]">
                <div className="text-[#8B7FA8] text-xs font-bold uppercase tracking-wider mb-1">Generated Revenue</div>
                <div className="text-lg font-bold text-[#3A2472]">{fmtMoney(selectedVehicle.rev)}</div>
              </div>
              <div className="bg-[#FDF0F7] p-4 rounded-xl border border-[#F9D6E7]">
                <div className="text-[#8B7FA8] text-xs font-bold uppercase tracking-wider mb-1">Total Expenses</div>
                <div className="text-lg font-bold text-[#C4237F]">{fmtMoney(selectedVehicle.exp)}</div>
              </div>
              <div className={`p-4 rounded-xl border ${selectedVehicle.net >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-[#8B7FA8] text-xs font-bold uppercase tracking-wider mb-1">Net Profit</div>
                <div className={`text-lg font-bold ${selectedVehicle.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(selectedVehicle.net)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Income Sources Table */}
              <div>
                <h3 className="text-[#241A3D] font-semibold mb-4 border-b border-[#E4DCF0] pb-2 flex items-center gap-2">
                  <TrendingUp size={16} className="text-green-600" /> Income Sources ({selectedVehicle.invSources.length})
                </h3>
                {selectedVehicle.invSources.length === 0 ? (
                  <p className="text-[#8B7FA8] text-sm">No invoices recorded for this month.</p>
                ) : (
                  <ul className="space-y-3">
                    {selectedVehicle.invSources.map((src, i) => (
                      <li key={i} className="flex justify-between items-start text-sm p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div>
                          <div className="font-medium text-[#241A3D]">{src.customer}</div>
                          <div className="text-xs text-[#8B7FA8] mt-0.5">{src.desc} &bull; {formatDateNG(src.date)}</div>
                        </div>
                        <div className="font-semibold text-[#3A2472] whitespace-nowrap ml-4">{fmtMoney(src.amount)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Expense Sources Table */}
              <div>
                <h3 className="text-[#241A3D] font-semibold mb-4 border-b border-[#E4DCF0] pb-2 flex items-center gap-2">
                  <TrendingDown size={16} className="text-red-500" /> Expense Logs ({selectedVehicle.expSources.length})
                </h3>
                {selectedVehicle.expSources.length === 0 ? (
                  <p className="text-[#8B7FA8] text-sm">No expenses logged for this month.</p>
                ) : (
                  <ul className="space-y-3">
                    {selectedVehicle.expSources.map((src, i) => (
                      <li key={i} className="flex justify-between items-start text-sm p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div>
                          <div className="font-medium text-[#241A3D] capitalize">{src.desc}</div>
                          <div className="text-xs text-[#8B7FA8] mt-0.5">{formatDateNG(src.date)}</div>
                        </div>
                        <div className="font-semibold text-[#C4237F] whitespace-nowrap ml-4">{fmtMoney(src.amount)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

        ) : (
          /* --- MACRO VIEW: GLOBAL DASHBOARD --- */
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* Global Scoreboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-[#E4DCF0] shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-2 text-[#8B7FA8] text-sm font-semibold uppercase tracking-wider mb-2">
                  <TrendingUp size={16} className="text-[#3A2472]" /> Total Revenue
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-[#3A2472]">{fmtMoney(globalTotals.rev)}</div>
              </div>
              
              <div className="bg-white p-6 rounded-2xl border border-[#E4DCF0] shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-2 text-[#8B7FA8] text-sm font-semibold uppercase tracking-wider mb-2">
                  <TrendingDown size={16} className="text-[#C4237F]" /> Total Expenses
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-[#C4237F]">{fmtMoney(globalTotals.exp)}</div>
              </div>
              
              <div className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-center ${globalTotals.net >= 0 ? 'bg-gradient-to-br from-green-50 to-white border-green-200' : 'bg-gradient-to-br from-red-50 to-white border-red-200'}`}>
                <div className="flex items-center gap-2 text-[#8B7FA8] text-sm font-semibold uppercase tracking-wider mb-2">
                  <Activity size={16} className={globalTotals.net >= 0 ? 'text-green-600' : 'text-red-500'} /> Net Profit
                </div>
                <div className={`text-2xl sm:text-3xl font-bold ${globalTotals.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {globalTotals.net >= 0 ? '+' : ''} {fmtMoney(globalTotals.net)}
                </div>
              </div>
            </div>

            {/* Fleet Grid Groups */}
            {['mixer', 'pump', 'excavator'].map(type => {
              const groupStats = fleetStats.filter(v => v.type === type);
              if (groupStats.length === 0) return null;

              return (
                <div key={type}>
                  <h3 className="font-semibold text-[13px] tracking-widest uppercase text-[#3A2472] mb-4">{type}s Performance</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {groupStats.map(v => (
                      <div 
                        key={v.id} 
                        onClick={() => setSelectedVehicleId(v.id)}
                        className="bg-white border border-[#E4DCF0] rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-[#C4237F] transition-all group relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <VehicleIcon type={v.type} size={20} className="text-[#C4237F]" />
                            <span className="font-semibold text-[#241A3D] text-sm">{v.name}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-[#8B7FA8]">Rev:</span>
                            <span className="font-semibold text-[#3A2472]">{fmtMoney(v.rev)}</span>
                          </div>
                          <div className="flex justify-between border-b border-[#F5F1FA] pb-2">
                            <span className="text-[#8B7FA8]">Exp:</span>
                            <span className="font-semibold text-[#C4237F]">{fmtMoney(v.exp)}</span>
                          </div>
                          <div className="flex justify-between pt-1">
                            <span className="text-[#8B7FA8] font-medium">Net:</span>
                            <span className={`font-bold ${v.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {fmtMoney(v.net)}
                            </span>
                          </div>
                        </div>

                        {/* Subtle background decoration */}
                        <svg width="40" height="40" viewBox="0 0 60 60" className="absolute -top-2 -right-2 opacity-5 group-hover:opacity-10 transition-opacity">
                          <polygon points="60,0 60,60 0,0" fill={v.type === "pump" ? "#3A2472" : "#C4237F"} />
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  );
}