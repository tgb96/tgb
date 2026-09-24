// Cada elemento es una unidad repetible. Solo el pan Ideal 100% Integral tiene
// nutrientes automáticos: 2 rebanadas (63 g) = 146 kcal, 7,56 P, 24,57 C, 1,95 G.
// Fuente: https://www.jumbo.cl/pan-molde-100-int-2087389/p
const food = (name, portion, metrics = null) => ({ name, portion, ...metrics });

export const foodCatalog = {
  integralBread: food("Pan integral Ideal 100%", "1 rebanada · aprox. 31,5 g", { kcal: 73, proteinG: 3.78, carbsG: 12.285, fatG: 0.975 }),
  whiteBread: food("Pan de molde normal", "1 rebanada"),
  egg: food("Huevo", "1 unidad"),
  avocado: food("Palta", "1 porción pequeña"),
  cheeseSlice: food("Queso", "1 lámina"),
  hamSlice: food("Jamón", "1 lámina"),
  butter: food("Mantequilla", "1 untada pequeña"),
  yogurtPlain: food("Yogur normal", "1 envase"),
  yogurtProtein: food("Yogur alto en proteína", "1 envase"),
  milk: food("Leche", "1 vaso"),
  proteinDrink: food("Bebida proteica", "1 envase"),
  applePortion: food("Manzana", "1 porción · aprox. ½ unidad"),
  bananaPortion: food("Plátano", "1 porción · aprox. ½ unidad"),
  kiwi: food("Kiwi", "1 unidad"),
  granola: food("Granola", "1 cucharada · aprox. 10 g"),
  oats: food("Avena", "1 cucharada · aprox. 10 g"),
  nuts: food("Frutos secos", "1 puñado pequeño"),
  rice: food("Arroz cocido", "1 porción · aprox. ½ taza"),
  pasta: food("Fideos cocidos", "1 porción · aprox. ½ taza"),
  potato: food("Papa", "1 unidad mediana"),
  chicken: food("Pollo", "1 porción · aprox. 100 g cocidos"),
  beef: food("Carne de vacuno", "1 porción · aprox. 100 g cocidos"),
  pork: food("Cerdo", "1 porción · aprox. 100 g cocidos"),
  fish: food("Pescado", "1 porción · aprox. 100 g cocidos"),
  tomatoSauce: food("Salsa de tomate", "1 porción · aprox. ½ taza"),
  bolognese: food("Salsa boloñesa", "1 porción · aprox. ½ taza"),
  vegetables: food("Verduras", "1 porción · aprox. ½ taza"),
  tomato: food("Tomate", "1 porción · aprox. ½ unidad"),
  crackers: food("Galletas de agua", "1 porción"),
  honey: food("Miel", "1 cucharadita"),
  cerealBar: food("Barra de cereal", "1 unidad")
};

const breakfast = ["integralBread", "whiteBread", "egg", "avocado", "cheeseSlice", "hamSlice", "butter", "yogurtPlain", "yogurtProtein", "milk", "proteinDrink", "applePortion", "bananaPortion", "granola", "oats"];
const snack = ["yogurtPlain", "yogurtProtein", "applePortion", "bananaPortion", "integralBread", "whiteBread", "hamSlice", "cheeseSlice", "avocado", "granola", "nuts", "proteinDrink"];
const main = ["rice", "chicken", "beef", "pasta", "potato", "fish", "pork", "tomatoSauce", "bolognese", "vegetables", "tomato", "egg", "integralBread"];

export function foodsForSlot(slotId, query = "") {
  const preferred = slotId === "breakfast" ? breakfast : ["morning", "pre", "snack", "during"].includes(slotId) ? snack : main;
  const search = String(query).trim().toLocaleLowerCase("es-CL");
  const ids = search ? Object.keys(foodCatalog) : preferred;
  return ids.filter(id => !search || `${foodCatalog[id].name} ${foodCatalog[id].portion}`.toLocaleLowerCase("es-CL").includes(search))
    .map(id => ({ id, ...foodCatalog[id] }));
}

export function describeParts(parts) {
  return Object.entries(parts || {}).filter(([id, count]) => foodCatalog[id] && Number.isInteger(count) && count > 0)
    .map(([id, count]) => `${count} × ${foodCatalog[id].name.toLowerCase()} (${foodCatalog[id].portion})`).join(" · ");
}

export function knownPartsSubtotal(parts) {
  const totals = { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, knownItems: 0, unknownItems: 0 };
  for (const [id, count] of Object.entries(parts || {})) {
    const item = foodCatalog[id];
    if (!item || !Number.isInteger(count) || count <= 0) continue;
    if (item.kcal == null) { totals.unknownItems += count; continue; }
    totals.knownItems += count;
    totals.caloriesKcal += item.kcal * count;
    totals.proteinG += item.proteinG * count;
    totals.carbsG += item.carbsG * count;
    totals.fatG += item.fatG * count;
  }
  return totals;
}

export function estimateParts(parts) {
  const subtotal = knownPartsSubtotal(parts);
  if (!subtotal.knownItems || subtotal.unknownItems) return null;
  return Object.fromEntries(["caloriesKcal", "proteinG", "carbsG", "fatG"]
    .map(key => [key, Math.round(subtotal[key] * 10) / 10]));
}
