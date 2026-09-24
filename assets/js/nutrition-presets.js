// Porciones habituales ilustrativas, no medidas personales ni etiquetas de marca.
// Referencias generales: USDA FoodData Central (https://fdc.nal.usda.gov/).
export const foodCatalog = {
  egg: { name: "Huevo", portion: "1 unidad · 50 g", kcal: 72, proteinG: 6, carbsG: 0, fatG: 5 },
  bread: { name: "Pan integral", portion: "1 rebanada · 30 g", kcal: 75, proteinG: 3, carbsG: 13, fatG: 1 },
  arepa: { name: "Arepa", portion: "1 unidad · 80 g", kcal: 170, proteinG: 3, carbsG: 34, fatG: 2 },
  oats: { name: "Avena", portion: "40 g secos", kcal: 150, proteinG: 5, carbsG: 27, fatG: 3 },
  milk: { name: "Leche", portion: "200 ml", kcal: 100, proteinG: 7, carbsG: 10, fatG: 4 },
  banana: { name: "Plátano", portion: "1 mediano · 120 g", kcal: 105, proteinG: 1, carbsG: 27, fatG: 0 },
  kiwi: { name: "Kiwi", portion: "1 mediano · 75 g", kcal: 45, proteinG: 1, carbsG: 11, fatG: 0 },
  apple: { name: "Manzana", portion: "1 mediana · 150 g", kcal: 80, proteinG: 0, carbsG: 21, fatG: 0 },
  yogurt: { name: "Yogurt alto en proteína", portion: "1 envase · 170 g", kcal: 115, proteinG: 17, carbsG: 11, fatG: 0 },
  granola: { name: "Granola", portion: "40 g", kcal: 180, proteinG: 4, carbsG: 27, fatG: 7 },
  nuts: { name: "Frutos secos", portion: "25 g", kcal: 150, proteinG: 5, carbsG: 5, fatG: 13 },
  proteinDrink: { name: "Bebida tipo Protein+", portion: "250 ml · referencia genérica", kcal: 160, proteinG: 25, carbsG: 13, fatG: 2 },
  ham: { name: "Jamón cocido", portion: "40 g", kcal: 50, proteinG: 8, carbsG: 1, fatG: 2 },
  cheese: { name: "Queso", portion: "30 g", kcal: 105, proteinG: 7, carbsG: 1, fatG: 8 },
  rice: { name: "Arroz cocido", portion: "150 g · 1 taza aprox.", kcal: 195, proteinG: 4, carbsG: 43, fatG: 0 },
  potato: { name: "Papa cocida", portion: "200 g · 1–2 unidades", kcal: 170, proteinG: 4, carbsG: 40, fatG: 0 },
  pasta: { name: "Fideos cocidos", portion: "150 g · 1 taza aprox.", kcal: 235, proteinG: 8, carbsG: 47, fatG: 1 },
  chicken: { name: "Pollo cocido", portion: "150 g", kcal: 245, proteinG: 46, carbsG: 0, fatG: 5 },
  beef: { name: "Carne magra cocida", portion: "150 g", kcal: 285, proteinG: 39, carbsG: 0, fatG: 14 },
  pork: { name: "Cerdo magro cocido", portion: "150 g", kcal: 255, proteinG: 42, carbsG: 0, fatG: 9 },
  tuna: { name: "Atún al agua escurrido", portion: "100 g", kcal: 115, proteinG: 25, carbsG: 0, fatG: 1 },
  vegetables: { name: "Verduras variadas", portion: "150 g · sin aceite añadido", kcal: 55, proteinG: 2, carbsG: 10, fatG: 1 },
  tomato: { name: "Tomate", portion: "100 g", kcal: 20, proteinG: 1, carbsG: 4, fatG: 0 },
  crackers: { name: "Galletas de agua", portion: "30 g", kcal: 120, proteinG: 2, carbsG: 23, fatG: 2 },
  honey: { name: "Miel", portion: "15 g · 1 cucharada pequeña", kcal: 45, proteinG: 0, carbsG: 12, fatG: 0 },
  cerealBar: { name: "Barra de cereal simple", portion: "35 g", kcal: 140, proteinG: 2, carbsG: 25, fatG: 4 }
};

const preset = (id, title, parts) => ({ id, title, parts });
export const mealPresets = {
  eggsBreadBanana: preset("eggsBreadBanana", "2 huevos + 2 rebanadas de pan integral + plátano", { egg: 2, bread: 2, banana: 1 }),
  eggsArepaKiwi: preset("eggsArepaKiwi", "2 huevos + arepa + kiwi", { egg: 2, arepa: 1, kiwi: 1 }),
  yogurtGranolaBanana: preset("yogurtGranolaBanana", "Yogurt alto en proteína + 40 g granola + plátano", { yogurt: 1, granola: 1, banana: 1 }),
  hamCheeseSandwich: preset("hamCheeseSandwich", "Pan integral con jamón y queso (2 rebanadas)", { bread: 2, ham: 1, cheese: 1 }),
  oatsMilkBanana: preset("oatsMilkBanana", "40 g avena + 200 ml leche + plátano", { oats: 1, milk: 1, banana: 1 }),
  proteinSandwich: preset("proteinSandwich", "Bebida tipo Protein+ + pan integral con jamón y queso", { proteinDrink: 1, bread: 2, ham: 1, cheese: 1 }),
  yogurtApple: preset("yogurtApple", "Yogurt alto en proteína + manzana", { yogurt: 1, apple: 1 }),
  proteinBanana: preset("proteinBanana", "Bebida tipo Protein+ + plátano", { proteinDrink: 1, banana: 1 }),
  appleNuts: preset("appleNuts", "Manzana + 25 g de frutos secos", { apple: 1, nuts: 1 }),
  sandwichBanana: preset("sandwichBanana", "Pan integral con jamón y queso + plátano", { bread: 2, ham: 1, cheese: 1, banana: 1 }),
  arepaEggKiwi: preset("arepaEggKiwi", "Arepa + huevo + kiwi", { arepa: 1, egg: 1, kiwi: 1 }),
  smallChickenRice: preset("smallChickenRice", "Pollo (100 g) + arroz cocido (100 g)", { chicken: 2 / 3, rice: 2 / 3 }),
  chickenRiceVeg: preset("chickenRiceVeg", "Pollo (150 g) + arroz (1 taza) + verduras", { chicken: 1, rice: 1, vegetables: 1 }),
  beefPotatoVeg: preset("beefPotatoVeg", "Carne magra (150 g) + papas (200 g) + verduras", { beef: 1, potato: 1, vegetables: 1 }),
  porkPastaVeg: preset("porkPastaVeg", "Cerdo magro (150 g) + fideos (1 taza) + verduras", { pork: 1, pasta: 1, vegetables: 1 }),
  tunaRiceTomato: preset("tunaRiceTomato", "Atún al agua (100 g) + arroz (1 taza) + tomate", { tuna: 1, rice: 1, tomato: 1 }),
  eggBreadTomato: preset("eggBreadTomato", "Tortilla de 2 huevos + pan integral (2 rebanadas) + tomate", { egg: 2, bread: 2, tomato: 1 }),
  tunaBreadTomato: preset("tunaBreadTomato", "Atún al agua (100 g) + pan integral (2 rebanadas) + tomate", { tuna: 1, bread: 2, tomato: 1 }),
  banana: preset("banana", "Plátano mediano", { banana: 1 }),
  apple: preset("apple", "Manzana mediana", { apple: 1 }),
  cerealBar: preset("cerealBar", "Barra de cereal simple (35 g)", { cerealBar: 1 }),
  crackersHoney: preset("crackersHoney", "Galletas de agua (30 g) + miel (15 g)", { crackers: 1, honey: 1 })
};

const presetGroups = {
  breakfast: ["eggsBreadBanana", "eggsArepaKiwi", "yogurtGranolaBanana", "hamCheeseSandwich", "oatsMilkBanana", "proteinSandwich"],
  morning: ["yogurtApple", "proteinBanana", "appleNuts", "hamCheeseSandwich"],
  lunch: ["chickenRiceVeg", "beefPotatoVeg", "porkPastaVeg", "tunaRiceTomato"],
  pre: ["sandwichBanana", "arepaEggKiwi", "yogurtGranolaBanana", "smallChickenRice"],
  snack: ["banana", "apple", "cerealBar", "crackersHoney"],
  during: ["banana", "cerealBar"],
  post: ["proteinSandwich", "yogurtGranolaBanana", "tunaBreadTomato", "chickenRiceVeg"],
  dinner: ["chickenRiceVeg", "beefPotatoVeg", "eggBreadTomato", "tunaBreadTomato"]
};

export const presetsForSlot = slotId => (presetGroups[slotId] || []).map(id => mealPresets[id]);
export function estimatePreset(preset) {
  if (!preset) return null;
  const totals = { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const [id, count] of Object.entries(preset.parts)) {
    const food = foodCatalog[id];
    if (!food || !Number.isFinite(count) || count <= 0) return null;
    totals.caloriesKcal += food.kcal * count;
    totals.proteinG += food.proteinG * count;
    totals.carbsG += food.carbsG * count;
    totals.fatG += food.fatG * count;
  }
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.round(value)]));
}
