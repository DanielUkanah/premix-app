"use client";

import { useState } from "react";

export default function TermsEditor({ terms, onChange }) {
  const [draft, setDraft] = useState("");

  function addTerm() {
    if (!draft.trim()) return;
    onChange([...terms, draft.trim()]);
    setDraft("");
  }

  function removeTerm(idx) {
    onChange(terms.filter((_, i) => i !== idx));
  }

  return (
    <div className="card p-4">
      <h3 className="font-semibold text-[var(--brand-purple)] mb-3">Terms and conditions</h3>
      <ol className="list-decimal list-inside space-y-1 text-sm mb-3">
        {terms.map((t, i) => (
          <li key={i} className="flex items-start justify-between gap-2">
            <span>{t}</span>
            <button onClick={() => removeTerm(i)} className="text-[var(--brand-magenta)] text-xs shrink-0">
              remove
            </button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTerm()}
          placeholder="Add a term, e.g. Client to provide diesel fuel on site"
          className="flex-1 border border-[var(--brand-border)] rounded px-2 py-1 text-sm"
        />
        <button onClick={addTerm} className="bg-[var(--brand-purple)] text-white px-3 py-1 rounded text-sm">
          Add
        </button>
      </div>
    </div>
  );
}
