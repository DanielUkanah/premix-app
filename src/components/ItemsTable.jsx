import React from "react";
import { Edit2 } from "lucide-react";

export default function ItemsTable({ items, onRemove, onUpdate, discPct, taxPct }) {
  // 1. Calculate Subtotal
  const subtotal = items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.rate || 0)), 0);
  
  // 2. Calculate General Discount
  const discountAmt = subtotal * (Number(discPct || 0) / 100);
  
  // 3. Calculate Smart VAT (ONLY applies to items with isEquipment: true)
  const vatAmt = items.reduce((sum, item) => {
    if (item.isEquipment) {
      const itemTotal = Number(item.qty || 0) * Number(item.rate || 0);
      const itemDiscount = itemTotal * (Number(discPct || 0) / 100);
      return sum + ((itemTotal - itemDiscount) * (Number(taxPct || 0) / 100));
    }
    return sum;
  }, 0);

  // 4. Grand Total
  const grandTotal = subtotal - discountAmt + vatAmt;

  return (
    <section className="card p-4 overflow-x-auto">
      <h3 className="font-semibold text-[#3A2472] mb-3">Invoice items</h3>
      {items.length === 0 ? (
        <div className="text-sm text-[#8B7FA8] py-4 text-center">No items added yet. Click an item from the catalog above.</div>
      ) : (
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-[#E4DCF0] text-[#3A2472]">
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 font-semibold w-24">Qty / Days</th>
              <th className="py-2 font-semibold w-48">Rate (NGN)</th>
              <th className="py-2 font-semibold text-right">Amount</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const itemTotal = Number(item.qty || 0) * Number(item.rate || 0);
              return (
                <tr key={idx} className="border-b border-[#E4DCF0]">
                  <td className="py-3 pr-2">
                    <div className="font-medium text-[#241A3D]">{item.name}</div>
                    <div className="text-xs text-[#8B7FA8]">{item.description}</div>
                    {item.isEquipment && (
                      <span className="text-[10px] bg-[#FDF0F7] text-[#C4237F] px-1.5 py-0.5 rounded mt-1 inline-block font-medium">
                        VAT Applies
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    <input 
                      type="number" 
                      min="1"
                      value={item.qty} 
                      onChange={(e) => onUpdate(idx, "qty", e.target.value)}
                      className="w-16 border border-[#E4DCF0] rounded px-2 py-1 outline-none focus:border-[#C4237F] text-center"
                    />
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2 group">
                      <input 
                        type="number" 
                        value={item.rate} 
                        onChange={(e) => onUpdate(idx, "rate", e.target.value)}
                        className="w-28 border border-transparent hover:border-[#E4DCF0] rounded px-2 py-1 outline-none focus:border-[#C4237F] transition-colors bg-transparent"
                      />
                      <Edit2 size={14} className="text-[#8B7FA8] opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </td>
                  <td className="py-3 text-right font-medium text-[#241A3D]">
                    {itemTotal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => onRemove(idx)} className="text-xs text-[#C4237F] font-medium hover:underline">
                      remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-[#3A2472]">
            <tr>
              <td colSpan="3" className="py-2 text-[#8B7FA8]">Subtotal</td>
              <td className="py-2 text-right font-medium text-[#241A3D]">{subtotal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
              <td></td>
            </tr>
            {discPct > 0 && (
              <tr>
                <td colSpan="3" className="py-1 text-[#8B7FA8]">Discount ({discPct}%)</td>
                <td className="py-1 text-right text-[#C4237F]">- {discountAmt.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
                <td></td>
              </tr>
            )}
            <tr>
              <td colSpan="3" className="py-1 text-[#8B7FA8]">VAT ({taxPct}%) — <span className="text-xs italic">Equipment Only</span></td>
              <td className="py-1 text-right text-[#8B7FA8]">{vatAmt.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
              <td></td>
            </tr>
            <tr className="text-base font-semibold">
              <td colSpan="3" className="py-3 text-[#3A2472]">Grand total</td>
              <td className="py-3 text-right text-[#241A3D]">NGN {grandTotal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}