"use client";
import { useState } from "react";
import { X, Plus } from "lucide-react";

export default function TermsEditor({ terms, onChange }) {
  const [newTerm, setNewTerm] = useState("");

  function addTerm() {
    const trimmed = newTerm.trim();
    if (!trimmed) return;
    onChange([...terms, trimmed]);
    setNewTerm("");
  }

  function removeTerm(idx) {
    onChange(terms.filter((_, i) => i !== idx));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTerm();
    }
  }

  return (
    <section className="card p-4 sm:p-5">
      <h3 className="font-semibold text-[#3A2472] mb-3">Terms and conditions</h3>

      {terms.length === 0 ? (
        <p className="text-sm text-[#6f6480] mb-4">No terms added yet — they'll appear on the invoice in the order you add them.</p>
      ) : (
        <ul className="space-y-2.5 mb-4">
          {terms.map((term, idx) => (
            <li
              key={idx}
              className="flex items-start justify-between gap-3 border border-[#E4DCF0] rounded-lg px-3.5 py-3 bg-white"
            >
              <span className="text-sm text-[#241A3D] leading-relaxed">{term}</span>
              <button
                onClick={() => removeTerm(idx)}
                className="shrink-0 flex items-center gap-1 text-[#C4237F] text-xs font-semibold hover:opacity-75 transition-opacity"
              >
                <X size={13} /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a term, e.g. Client to provide diesel fuel…"
          className="flex-1 border border-[#E4DCF0] rounded-lg px-3 py-2.5 text-sm focus:border-[#C4237F] outline-none"
        />
        <button
          onClick={addTerm}
          disabled={!newTerm.trim()}
          className="bg-[#3A2472] text-white rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus size={15} /> Add
        </button>
      </div>
    </section>
  );
}
