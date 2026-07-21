"use client";
import { useRef, useState } from "react";
import { Plus, Check, Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { getItemCategory, dedupeByName, CATEGORY_META, CATEGORY_TRUCK, CATEGORY_SERVICE, CATEGORY_FUEL } from "@/lib/catalogRules";

// Tiny synthesized "pop" sound — no audio file to host.
// Falls back silently if the browser blocks audio before a user gesture.
function playPop() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(720, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(340, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
    osc.onended = () => ctx.close();
  } catch {
    // ignore — audio is a nice-to-have, never block the add action on it
  }
}

const GROUP_ORDER = [CATEGORY_TRUCK, CATEGORY_SERVICE, CATEGORY_FUEL];

export default function CatalogPicker({ catalog, onAddItem, onAddNewCatalogItem }) {
  const [query, setQuery] = useState("");
  const [flashId, setFlashId] = useState(null);
  const [toasts, setToasts] = useState([]);
  // Trucks is the long list (all mixers + pumps) — start it collapsed so
  // people aren't greeted with a wall of near-identical cards.
  const [collapsed, setCollapsed] = useState({ [CATEGORY_TRUCK]: true });
  const [addingNew, setAddingNew] = useState(false);
  const [newCategory, setNewCategory] = useState(CATEGORY_TRUCK);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const toastId = useRef(0);

  function showToast(text) {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1800);
  }

  function handleAdd(item) {
    onAddItem(item);
    playPop();
    setFlashId(item.id);
    showToast(`${item.name} added`);
    setTimeout(() => setFlashId((cur) => (cur === item.id ? null : cur)), 500);
  }

  async function handleSaveNew() {
    if (!newName.trim() || !newRate) return;
    setSavingNew(true);
    try {
      const meta = CATEGORY_META[newCategory];
      await onAddNewCatalogItem({
        name: newName.trim(),
        rate: Number(newRate) || 0,
        type: meta.type,
        category: newCategory,
        vatApplies: newCategory === CATEGORY_TRUCK,
      });
      setNewName("");
      setNewRate("");
      setNewCategory(CATEGORY_TRUCK);
      setAddingNew(false);
    } finally {
      setSavingNew(false);
    }
  }

  const searched = catalog.filter((item) =>
    item.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const groups = searched.reduce((acc, item) => {
    const cat = getItemCategory(item);
    if (!cat) return acc; // unclassified items are hidden, not dumped in a catch-all
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Only Services/Fuel get de-duplicated — Trucks keeps every entry exactly
  // as-is, since two same-named pumps are two different real trucks, not
  // accidental duplicates.
  if (groups[CATEGORY_SERVICE]) groups[CATEGORY_SERVICE] = dedupeByName(groups[CATEGORY_SERVICE]);
  if (groups[CATEGORY_FUEL]) groups[CATEGORY_FUEL] = dedupeByName(groups[CATEGORY_FUEL]);
  const groupOrder = GROUP_ORDER.filter((g) => groups[g]);
  const visibleCount = groupOrder.reduce((sum, g) => sum + groups[g].length, 0);

  return (
    <section className="card p-4 sm:p-5 relative">
      <h3 className="font-semibold text-[#3A2472] mb-3">Catalog — tap to add</h3>

      {catalog.length > 6 && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a89bb8]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search equipment or service…"
            className="w-full pl-9 pr-9 py-2.5 border border-[#E4DCF0] rounded-lg text-sm focus:border-[#C4237F] outline-none bg-white"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a89bb8] hover:text-[#3A2472]"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {groupOrder.map((cat) => {
          const label = CATEGORY_META[cat].groupLabel;
          const isOpen = query.trim() !== "" || !collapsed[cat];
          return (
            <div key={cat} className="border border-[#F0ECF5] rounded-xl overflow-hidden">
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [cat]: !c[cat] }))}
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#FAF7FC] text-left"
              >
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#3A2472]">
                  {label} <span className="text-[#a89bb8] font-medium normal-case">({groups[cat].length})</span>
                </span>
                {isOpen ? <ChevronDown size={16} className="text-[#3A2472]" /> : <ChevronRight size={16} className="text-[#3A2472]" />}
              </button>
              {isOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3">
                  {groups[cat].map((item) => {
                    const isFlashing = flashId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleAdd(item)}
                        className={`w-full text-left border rounded-xl px-4 py-3.5 transition-all duration-150 flex items-center justify-between gap-3 active:scale-[0.97] ${
                          isFlashing
                            ? "border-[#C4237F] bg-[#FDEAF3] ring-2 ring-[#C4237F]/25"
                            : "border-[#E4DCF0] bg-white hover:border-[#C4237F]/50 hover:bg-[#FAF7FC]"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[#241A3D] text-[15px] truncate">{item.name}</div>
                          <div className="text-[13px] text-[#6f6480] mt-0.5">
                            ₦{Number(item.rate || 0).toLocaleString("en-NG")} · {item.type}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                            isFlashing ? "bg-[#C4237F] text-white scale-110" : "bg-[#F7F5FA] text-[#3A2472]"
                          }`}
                        >
                          {isFlashing ? <Check size={18} /> : <Plus size={18} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {visibleCount === 0 && (
          <p className="text-sm text-[#6f6480] text-center py-4">No matching items — try a different search.</p>
        )}
      </div>

      <div className="mt-5">
        {!addingNew ? (
          <button
            onClick={() => setAddingNew(true)}
            className="w-full border-2 border-dashed border-[#E4DCF0] rounded-xl py-3.5 text-[#3A2472] font-medium text-sm hover:border-[#C4237F]/50 hover:bg-[#FAF7FC] transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add new equipment / service
          </button>
        ) : (
          <div className="border border-[#E4DCF0] rounded-xl p-4 space-y-3 bg-[#FAF7FC]">
            <div>
              <label className="block text-xs font-semibold text-[#6f6480] mb-1.5">What is this?</label>
              <div className="grid grid-cols-3 gap-2">
                {GROUP_ORDER.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNewCategory(cat)}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      newCategory === cat
                        ? "bg-[#3A2472] border-[#3A2472] text-white"
                        : "bg-white border-[#E4DCF0] text-[#6f6480]"
                    }`}
                  >
                    {CATEGORY_META[cat].label}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={newCategory === CATEGORY_FUEL ? "Name, e.g. Diesel" : "Name, e.g. Water Tanker"}
              className="w-full border border-[#E4DCF0] rounded-lg px-3 py-2.5 text-sm bg-white focus:border-[#C4237F] outline-none"
            />
            <div>
              <input
                type="number"
                min="0"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder={`Rate (${CATEGORY_META[newCategory].unitHint})`}
                className="w-full border border-[#E4DCF0] rounded-lg px-3 py-2.5 text-sm bg-white focus:border-[#C4237F] outline-none"
              />
              <p className="text-[11px] text-[#a89bb8] mt-1">
                {newCategory === CATEGORY_TRUCK && "Billed per day · VAT applies"}
                {newCategory === CATEGORY_SERVICE && "Billed as a flat fee · no VAT"}
                {newCategory === CATEGORY_FUEL && "Billed per litre · no VAT"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAddingNew(false)}
                className="flex-1 border border-[#E4DCF0] rounded-lg py-2.5 text-sm font-medium text-[#6f6480] bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNew}
                disabled={savingNew || !newName.trim() || !newRate}
                className="flex-1 bg-[#3A2472] text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {savingNew ? "Saving…" : "Save item"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast stack — confirms every add so it feels like a cart, not a guess */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none px-4 w-full sm:w-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-[#1f1230] text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <Check size={15} className="text-[#4ade80]" /> {t.text}
          </div>
        ))}
      </div>
    </section>
  );
}