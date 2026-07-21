"use client";
import { Trash2 } from "lucide-react";
import { getVatApplies } from "@/lib/catalogRules";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ItemsTable({ items, onRemove, onUpdate, discPct, taxPct }) {
  const lineAmount = (it) => Number(it.qty || 1) * Number(it.rate || 0);

  const subtotal = items.reduce((sum, it) => sum + lineAmount(it), 0);
  const vatableSubtotal = items.reduce((sum, it) => sum + (getVatApplies(it) ? lineAmount(it) : 0), 0);

  const discountAmt = subtotal * (Number(discPct) || 0) / 100;
  const vatableAfterDiscount = vatableSubtotal * (1 - (Number(discPct) || 0) / 100);
  const taxAmt = vatableAfterDiscount * (Number(taxPct) || 0) / 100;
  const grandTotal = (subtotal - discountAmt) + taxAmt;

  return (
    <section className="card p-4 sm:p-5">
      <h3 className="font-semibold text-[#3A2472] mb-3">Invoice items</h3>

      {items.length === 0 ? (
        <p className="text-sm text-[#6f6480] text-center py-6">No items added yet. Tap an item from the catalog above.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const amount = lineAmount(item);
            const vatApplies = getVatApplies(item);
            return (
              <div key={idx} className="border border-[#E4DCF0] rounded-xl p-3.5 sm:p-4">
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#241A3D] text-[15px]">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-[#6f6480] mt-0.5">{item.description}</div>
                    )}
                    {vatApplies && (
                      <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide bg-[#FDEAF3] text-[#C4237F] px-2 py-0.5 rounded-full">
                        VAT applies
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(idx)}
                    aria-label={`Remove ${item.name}`}
                    className="shrink-0 text-[#C4237F] hover:bg-[#FDEAF3] p-2 rounded-lg transition-colors"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="flex items-end justify-between gap-3 pt-3 border-t border-[#F0ECF5]">
                  <div className="flex gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#a89bb8] uppercase mb-1">Qty / Days</label>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => onUpdate(idx, "qty", Number(e.target.value) || 1)}
                        className="w-16 border border-[#E4DCF0] rounded-lg px-2 py-1.5 text-sm text-center focus:border-[#C4237F] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#a89bb8] uppercase mb-1">Rate (₦)</label>
                      <input
                        type="number"
                        min="0"
                        value={item.rate}
                        onChange={(e) => onUpdate(idx, "rate", Number(e.target.value) || 0)}
                        className="w-24 sm:w-28 border border-[#E4DCF0] rounded-lg px-2 py-1.5 text-sm focus:border-[#C4237F] outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-semibold text-[#a89bb8] uppercase mb-1">Amount</div>
                    <div className="font-bold text-[#3A2472] text-[15px] sm:text-base whitespace-nowrap">₦{fmt(amount)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className="border-t border-[#E4DCF0] mt-4 pt-4 space-y-1.5">
          <div className="flex justify-between text-sm text-[#6f6480]">
            <span>Subtotal</span>
            <span className="font-medium text-[#241A3D]">₦{fmt(subtotal)}</span>
          </div>
          {discPct > 0 && (
            <div className="flex justify-between text-sm text-[#6f6480]">
              <span>Discount ({discPct}%)</span>
              <span className="font-medium text-[#C4237F]">-₦{fmt(discountAmt)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-[#6f6480]">
            <span>VAT ({taxPct}% on truck hire only)</span>
            <span className="font-medium text-[#241A3D]">₦{fmt(taxAmt)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-[#3A2472] pt-2 border-t border-[#F0ECF5]">
            <span>Grand total</span>
            <span>₦{fmt(grandTotal)}</span>
          </div>
        </div>
      )}
    </section>
  );
}
