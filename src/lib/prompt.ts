import { RecipeRequestPayload } from "@/types/recipe";

const dietaryFocusDescriptions: Record<RecipeRequestPayload["dietaryFocus"], string> = {
  Balanced: "Ensure the meal has a balanced macronutrient profile with plenty of vitamins and minerals.",
  "High Protein": "Prioritize plant-based protein sources and aim for at least 20 grams of protein per serving while keeping fats moderate.",
  "Low Carb": "Keep total carbohydrates modest and use lower glycemic ingredients where possible while still providing enough energy.",
  "High Fiber": "Emphasize fiber-rich ingredients and aim for at least 8 grams of fiber per serving.",
  "Gluten Free": "Avoid gluten-containing grains and ensure all components are naturally gluten free."
};

const mealTypeDescriptions: Record<RecipeRequestPayload["mealType"], string> = {
  Any: "The meal can fit any time of day.",
  Breakfast: "Create a breakfast-friendly meal that can be prepared in the morning and feels energizing yet light.",
  Lunch: "Compose a satisfying lunch that can be enjoyed mid-day, suitable for a work break.",
  Dinner: "Develop a cozy dinner that feels complete and comforting for the evening.",
  Snack: "Produce a quick snack-style recipe that is easy to assemble and nutrient-dense."
};

export function buildRecipePrompt(payload: RecipeRequestPayload) {
  const ingredientLines = payload.ingredients
    .map((ingredient, index) => `${index + 1}. ${ingredient.name}${ingredient.note ? ` (${ingredient.note})` : ""}`)
    .join("\n");

  const seasoningLines = (payload.seasonings ?? [])
    .map((seasoning, index) => `${index + 1}. ${seasoning}`)
    .join("\n");

  const focusDescription = dietaryFocusDescriptions[payload.dietaryFocus];
  const mealDescription = mealTypeDescriptions[payload.mealType];
  const allowance = Math.max(0, Math.floor(payload.extraIngredientAllowance ?? 0));
  const extraIngredientGuidance =
    allowance === 0
      ? "Extra ingredients allowed: 0. Do not introduce any new ingredient names beyond the list (assume free access only to salt, pepper, water, and vegetable broth). If you need variety, transform the listed ingredients instead."
      : `Extra ingredients allowed: ${allowance}. Count every ingredient not listed above, including garnishes. Do not exceed this number. When you use an extra ingredient, append " (extra)" to its item string so the reviewer can audit it. Choose only common vegan pantry staples.`;

  return `You are an expert vegan chef and registered dietitian. Using the ingredients listed below (and adhering to the extra ingredient guidance), craft a fully plant-based recipe that is nutritionally balanced, exciting, and practical.

Ingredients on hand:\n${ingredientLines || "None specified"}

Preferred seasonings:\n${seasoningLines || "None specified"}

Constraints:
- The recipe must be 100% vegan (no animal products of any kind).
- ${mealDescription}
- ${focusDescription}
- Respect the number of servings: ${payload.servings}.
- ${extraIngredientGuidance}
- Seasonings listed above are provided by the cook. Use them when they reasonably fit the recipe and list them explicitly in the ingredients section; they do not count toward the extra ingredient allowance.
- Only reference ingredients in the instructions if they appear in the ingredients list above (basic staples excluded).
 - Include saturated fat and total sugars in the nutrition summary so it mirrors standard nutrition labels.
${payload.notes ? `- Additional notes from the cook: ${payload.notes}.` : ""}

Respond in strict JSON with the following structure:
{
  "title": string,
  "description": string,
  "servings": number,
  "prepTime": string,
  "cookTime": string,
  "ingredients": [{ "item": string, "quantity": string }],
  "instructions": [string],
  "nutrition": {
    "calories": string,
    "macros": {
      "protein": string,
      "carbohydrates": string,
      "fats": string,
      "saturatedFats": string,
      "sugars": string,
      "fiber": string
    },
    "micros": [string]
  },
  "tips": [string]
}

Ensure the instructions are detailed but concise, the nutrition section reflects realistic values for the recipe, and tips provide actionable advice. Do NOT include any additional commentary outside of the JSON.`;
}
