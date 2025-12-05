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

  const focusDescription = dietaryFocusDescriptions[payload.dietaryFocus];
  const mealDescription = mealTypeDescriptions[payload.mealType];

  return `You are an expert vegan chef and registered dietitian. Using ONLY the ingredients listed below (you may assume basic pantry staples like salt, pepper, water, or broth), craft a fully plant-based recipe that is nutritionally balanced, exciting, and practical.

Ingredients on hand:\n${ingredientLines || "None specified"}

Constraints:
- The recipe must be 100% vegan (no animal products of any kind).
- ${mealDescription}
- ${focusDescription}
- Respect the number of servings: ${payload.servings}.
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
      "fiber": string
    },
    "micros": [string]
  },
  "tips": [string]
}

Ensure the instructions are detailed but concise, the nutrition section reflects realistic values for the recipe, and tips provide actionable advice. Do NOT include any additional commentary outside of the JSON.`;
}
