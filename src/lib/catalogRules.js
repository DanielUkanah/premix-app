// Shared classification rules for catalog/invoice items.
// Both CatalogPicker and ItemsTable import this so a truck is always a
// truck and a service never quietly picks up VAT it shouldn't.

export const CATEGORY_TRUCK = "truck";
export const CATEGORY_SERVICE = "service";
export const CATEGORY_FUEL = "fuel";

export const CATEGORY_META = {
  [CATEGORY_TRUCK]: { label: "Truck", groupLabel: "Trucks", type: "per day", unitHint: "₦ per day" },
  [CATEGORY_SERVICE]: { label: "Service", groupLabel: "Services", type: "flat", unitHint: "₦ flat fee" },
  [CATEGORY_FUEL]: { label: "Fuel", groupLabel: "Fuel", type: "per litre", unitHint: "₦ per litre" },
};

// Works out which bucket a catalog/invoice item belongs to.
// Returns null when an item doesn't clearly belong anywhere — those get
// hidden from the picker instead of dumped into a catch-all group.
export function getItemCategory(item) {
  // Freshly added items (via the "add new" form) carry an explicit
  // category — always trust that first.
  if (item.category && CATEGORY_META[item.category]) return item.category;

  const type = (item.type || "").toLowerCase();
  const name = (item.name || "").toLowerCase();

  if (item.isEquipment || type.includes("day")) return CATEGORY_TRUCK;

  // Fuel: diesel only, nothing else.
  if (name.includes("diesel")) return CATEGORY_FUEL;

  // Services: Mobilization / Demobilization only (both spellings), nothing else.
  if (name.includes("mobiliz") || name.includes("mobilis")) return CATEGORY_SERVICE;

  return null;
}

// Only truck/equipment daily hire carries VAT — services (mob/demob) and
// fuel do not.
export function getVatApplies(item) {
  return getItemCategory(item) === CATEGORY_TRUCK;
}

// Collapses duplicate catalog entries that share the same name (e.g. the
// same "Diesel" item saved more than once in Firestore) so the picker only
// shows one card per real item. The underlying duplicates still exist in
// your data — this just avoids showing them twice.
//
// IMPORTANT: never run this on Trucks. Two pumps can legitimately share the
// exact same display name (e.g. two "Schwing Concrete Pump" entries) while
// being different physical units with different drivers and rates — that's
// not a duplicate, it's two trucks. Only Services/Fuel are safe to dedupe.
export function dedupeByName(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = (item.name || "").trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}