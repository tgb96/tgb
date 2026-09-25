// Porciones repetibles y valores orientativos redondeados. El pan Ideal usa su etiqueta
// (2 rebanadas de 63 g = 146,16 kcal). El resto son referencias genéricas: cambian por
// marca, variedad y preparación; no representan una medición del plato del usuario.
// Etiqueta: https://www.jumbo.cl/pan-molde-100-int-2087389/p
// Referencia general para alimentos sin marca: https://fdc.nal.usda.gov/
const food = (name, portion, kcal, proteinG, carbsG, fatG, source = "generic") =>
  ({ name, portion, kcal, proteinG, carbsG, fatG, source });
// Se conservan solo para leer comidas antiguas; no se pueden agregar a registros nuevos.
const retiredFoodIds = new Set(["kiwi", "oats", "honey"]);
export const isSelectableFood = id => Boolean(foodCatalog[id]) && !retiredFoodIds.has(id);

export const foodCatalog = {
  integralBread: food("Pan integral Ideal 100%", "1 rebanada · aprox. 31,5 g", 73, 3.78, 12.285, 0.975, "label"),
  semiIntegralArtisanBread: food("Pan semi integral artesanal", "1 rebanada · aprox. 45 g", 112, 4, 21, 1.5),
  whiteBread: food("Pan de molde normal", "1 rebanada · aprox. 30 g", 80, 2.5, 15, 1),
  egg: food("Huevo", "1 unidad · aprox. 50 g", 72, 6.3, 0.4, 4.8),
  avocado: food("Palta", "1 porción normal · aprox. 50 g", 80, 1, 4.3, 7.3),
  cheeseSlice: food("Queso", "1 lámina · aprox. 20 g", 80, 5, 0.3, 6.7),
  hamSlice: food("Jamón", "1 lámina · aprox. 20 g", 25, 4, 0.5, 1),
  butter: food("Mantequilla", "1 untada · aprox. 5 g", 36, 0, 0, 4.1),
  yogurtPlain: food("Yogur normal", "1 envase · aprox. 170 g", 110, 6, 9, 5),
  yogurtProtein: food("Yogur alto en proteína", "1 envase · aprox. 170 g", 120, 17, 10, 1),
  milk: food("Leche", "1 vaso · aprox. 200 ml", 120, 6.4, 9.6, 6.4),
  proteinDrink: food("Bebida proteica", "1 envase · aprox. 250 ml", 160, 25, 13, 2),
  applePortion: food("Manzana", "1 porción · aprox. ½ unidad (75 g)", 39, 0.2, 10.5, 0.1),
  bananaPortion: food("Plátano", "1 porción · aprox. ½ unidad (60 g)", 53, 0.7, 13.7, 0.2),
  kiwi: food("Kiwi", "1 unidad · aprox. 75 g", 46, 0.8, 11, 0.4),
  granola: food("Granola", "1 cucharada · aprox. 10 g", 45, 1, 6.5, 1.8),
  oats: food("Avena", "1 cucharada · aprox. 10 g", 39, 1.7, 6.6, 0.7),
  nuts: food("Frutos secos", "1 puñado pequeño · aprox. 25 g", 150, 5, 5, 13),
  rice: food("Arroz cocido", "1 porción · aprox. ½ taza (100 g)", 130, 2.7, 28, 0.3),
  pasta: food("Fideos cocidos", "1 porción · aprox. ½ taza (100 g)", 158, 5.8, 30.9, 0.9),
  potato: food("Papa", "1 unidad mediana · aprox. 150 g", 130, 3, 30, 0.2),
  chicken: food("Pollo", "1 porción · aprox. 100 g cocidos", 165, 31, 0, 3.6),
  beef: food("Carne de vacuno", "1 porción · aprox. 100 g cocidos", 200, 27, 0, 10),
  pork: food("Cerdo", "1 porción · aprox. 100 g cocidos", 200, 27, 0, 10),
  fish: food("Pescado", "1 porción · aprox. 100 g cocidos", 130, 26, 0, 3),
  tomatoSauce: food("Salsa de tomate", "1 porción · aprox. ½ taza (120 g)", 70, 2, 12, 2),
  bolognese: food("Salsa boloñesa", "1 porción · aprox. ½ taza (120 g)", 180, 10, 10, 10),
  vegetables: food("Verduras", "1 porción · aprox. ½ taza (80 g)", 35, 2, 6, 0.3),
  tomato: food("Tomate", "1 porción · aprox. ½ unidad (60 g)", 11, 0.5, 2.4, 0.1),
  crackers: food("Galletas de agua", "1 porción · aprox. 30 g", 120, 2, 23, 2),
  honey: food("Miel", "1 cucharadita · aprox. 7 g", 21, 0, 5.7, 0),
  cerealBar: food("Barra de cereal", "1 unidad · aprox. 35 g", 140, 2, 25, 4)
};

const breakfast = ["integralBread", "semiIntegralArtisanBread", "whiteBread", "egg", "avocado", "cheeseSlice", "hamSlice", "butter", "yogurtPlain", "yogurtProtein", "milk", "proteinDrink", "applePortion", "bananaPortion", "granola"];
const snack = ["yogurtPlain", "yogurtProtein", "applePortion", "bananaPortion", "integralBread", "semiIntegralArtisanBread", "whiteBread", "hamSlice", "cheeseSlice", "avocado", "granola", "nuts", "proteinDrink"];
const main = ["rice", "chicken", "beef", "pasta", "potato", "fish", "pork", "tomatoSauce", "bolognese", "vegetables", "tomato", "egg", "integralBread", "semiIntegralArtisanBread"];

export function foodsForSlot(slotId, query = "") {
  const preferred = slotId === "breakfast" ? breakfast : ["morning", "pre", "snack", "during"].includes(slotId) ? snack : main;
  const search = String(query).trim().toLocaleLowerCase("es-CL");
  const ids = search ? Object.keys(foodCatalog) : preferred;
  return ids.filter(id => isSelectableFood(id) && (!search || `${foodCatalog[id].name} ${foodCatalog[id].portion}`.toLocaleLowerCase("es-CL").includes(search)))
    .map(id => ({ id, ...foodCatalog[id] }));
}

export function describeParts(parts) {
  return Object.entries(parts || {}).filter(([id, count]) => foodCatalog[id] && Number.isInteger(count) && count > 0)
    .map(([id, count]) => `${count} × ${foodCatalog[id].name.toLowerCase()} (${foodCatalog[id].portion})`).join(" · ");
}

const compactFoodNames = {
  integralBread: "rebanada de pan integral", semiIntegralArtisanBread: "rebanada de pan semi integral artesanal", whiteBread: "rebanada de pan", egg: "huevo", avocado: "palta",
  cheeseSlice: "lámina de queso", hamSlice: "lámina de jamón", butter: "mantequilla", applePortion: "½ manzana",
  bananaPortion: "½ plátano"
};

const pluralize = (text, count) => count === 1 ? text : text
  .replace("rebanada", "rebanadas").replace("lámina", "láminas").replace("huevo", "huevos").replace("porción", "porciones");

export function summarizeParts(parts) {
  const counts = Object.fromEntries(Object.entries(parts || {}).filter(([id, count]) => foodCatalog[id] && Number.isInteger(count) && count > 0));
  const breadId = counts.integralBread ? "integralBread" : counts.semiIntegralArtisanBread ? "semiIntegralArtisanBread" : counts.whiteBread ? "whiteBread" : "";
  const pieces = [];
  if (breadId) {
    const breadCount = counts[breadId];
    const bread = `${breadCount} ${pluralize(compactFoodNames[breadId], breadCount)}`;
    const toppings = ["avocado", "cheeseSlice", "hamSlice", "butter"].filter(id => counts[id]).map(id => foodCatalog[id].name.toLocaleLowerCase("es-CL"));
    pieces.push(`${bread}${toppings.length ? ` con ${new Intl.ListFormat("es", { style: "long", type: "conjunction" }).format(toppings)}` : ""}`);
    delete counts[breadId];
    ["avocado", "cheeseSlice", "hamSlice", "butter"].forEach(id => delete counts[id]);
  }
  for (const [id, count] of Object.entries(counts)) {
    const compact = compactFoodNames[id] || foodCatalog[id].name.toLocaleLowerCase("es-CL");
    pieces.push(`${count === 1 && ["applePortion", "bananaPortion"].includes(id) ? "" : `${count} `}${pluralize(compact, count)}`.trim());
  }
  return pieces.join(" · ");
}

export function knownPartsSubtotal(parts) {
  const totals = { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, knownItems: 0, unknownItems: 0, genericItems: 0, labelItems: 0 };
  for (const [id, count] of Object.entries(parts || {})) {
    const item = foodCatalog[id];
    if (!Number.isInteger(count) || count <= 0) continue;
    if (!item) { totals.unknownItems += count; continue; }
    if (item.kcal == null) { totals.unknownItems += count; continue; }
    totals.knownItems += count;
    if (item.source === "label") totals.labelItems += count;
    else totals.genericItems += count;
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

export function nutritionEntryWithEstimate(entry) {
  if (entry?.kind !== "meal" || ["caloriesKcal", "proteinG", "carbsG", "fatG"].some(key => entry[key] != null)) return entry;
  const estimate = estimateParts(entry.parts);
  if (!estimate) return entry;
  return { ...entry, ...estimate, estimateSource: knownPartsSubtotal(entry.parts).genericItems ? "generic" : "label" };
}
