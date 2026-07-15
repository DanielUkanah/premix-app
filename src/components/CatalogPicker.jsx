import React, { useState } from "react";
import { Plus } from "lucide-react";

export default function CatalogPicker({ catalog, onAddItem, onAddNewCatalogItem }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("");
  const [isEquipment, setIsEquipment] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    
    const newItem = {
      name: newName,
      rate: Number(newRate) || 0,
      type: isEquipment ? "per day" : "flat fee",
      isEquipment: isEquipment, // This tells the table whether to apply VAT!
    };

    await onAddNewCatalogItem(newItem);
    
    setAdding(false);
    setNewName("");
    setNewRate("");
    setIsEquipment(false);
    setSaving(false);
  };

  return (
    <section className="card p-4">
      <h3 className="font-semibold text-[#3A2472] mb-3">Catalog — click to add</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Existing Catalog Items */}
        {catalog.map((item) => (
          <button
            key={item.id}
            onClick={() => onAddItem(item)}
            className="border border-[#E4DCF0] rounded-lg p-3 text-left hover:border-[#C4237F] hover:bg-[#FDF0F7] transition-colors"
          >
            <div className="font-medium text-[#241A3D]">{item.name}</div>
            <div className="text-xs text-[#8B7FA8] mt-1">
              NGN {(Number(item.rate) || 0).toLocaleString()} · {item.type || "flat fee"}
            </div>
          </button>
        ))}

        {/* Add New Item UI */}
        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="border border-dashed border-[#8B7FA8] rounded-lg p-3 text-left hover:bg-[#F5F1FA] transition-colors text-[#3A2472] flex items-center justify-center gap-2 font-medium"
          >
            <Plus size={16} /> Add new equipment / service
          </button>
        ) : (
          <div className="border border-[#C4237F] rounded-lg p-3 bg-[#FDF0F7] flex flex-col gap-2">
            <input 
              placeholder="Item name (e.g. Crane Hire)" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              className="w-full border border-[#E4DCF0] rounded px-2 py-1.5 text-sm outline-none focus:border-[#C4237F]" 
            />
            <div className="flex gap-2">
              <input 
                type="number" 
                placeholder="Rate (NGN)" 
                value={newRate} 
                onChange={(e) => setNewRate(e.target.value)} 
                className="w-1/2 border border-[#E4DCF0] rounded px-2 py-1.5 text-sm outline-none focus:border-[#C4237F]" 
              />
              <select 
                value={isEquipment ? "true" : "false"} 
                onChange={(e) => setIsEquipment(e.target.value === "true")}
                className="w-1/2 border border-[#E4DCF0] rounded px-2 py-1.5 text-sm outline-none focus:border-[#C4237F] bg-white"
              >
                <option value="false">Service (No VAT)</option>
                <option value="true">Equipment (Add VAT)</option>
              </select>
            </div>
            <div className="flex gap-2 mt-1">
              <button 
                onClick={handleSave} 
                disabled={saving || !newName}
                className="bg-[#C4237F] text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save to Database"}
              </button>
              <button 
                onClick={() => setAdding(false)} 
                className="text-[#8B7FA8] px-3 py-1.5 rounded text-sm hover:bg-[#E4DCF0] font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}