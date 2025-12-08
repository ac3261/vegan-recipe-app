'use client';

import { useMemo, useState } from "react";
import { ingredientOptions } from "@/data/ingredients";
import { RecipeRequestPayload, RecipeResponse, SelectedIngredient } from "@/types/recipe";

const mealTypes: RecipeRequestPayload["mealType"][] = [
  "Any",
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
];

const dietaryFocuses: RecipeRequestPayload["dietaryFocus"][] = [
  "Balanced",
  "High Protein",
  "Low Carb",
  "High Fiber",
  "Gluten Free",
];

interface GenerationState {
  loading: boolean;
  error?: string;
  recipe?: RecipeResponse;
  raw?: string;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [customIngredient, setCustomIngredient] = useState("");
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([]);
  const [seasoningQuery, setSeasoningQuery] = useState("");
  const [customSeasoning, setCustomSeasoning] = useState("");
  const [selectedSeasonings, setSelectedSeasonings] = useState<string[]>([]);
  const [mealType, setMealType] = useState<RecipeRequestPayload["mealType"]>("Dinner");
  const [dietaryFocus, setDietaryFocus] = useState<RecipeRequestPayload["dietaryFocus"]>("Balanced");
  const [servings, setServings] = useState(2);
  const [extraIngredientAllowance, setExtraIngredientAllowance] = useState(0);
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<GenerationState>({ loading: false });

  const filteredIngredients = useMemo(() => {
    if (!query) return ingredientOptions.slice(0, 20);
    return ingredientOptions.filter((item) =>
      item.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  const seasoningOptions = useMemo(
    () => ingredientOptions.filter((item) => item.category === "Seasonings"),
    []
  );

  const filteredSeasonings = useMemo(() => {
    if (!seasoningQuery) return seasoningOptions.slice(0, 20);
    return seasoningOptions.filter((item) =>
      item.name.toLowerCase().includes(seasoningQuery.toLowerCase())
    );
  }, [seasoningOptions, seasoningQuery]);

  const addIngredient = (name: string) => {
    setQuery("");
    setCustomIngredient("");
    setSelectedIngredients((prev) =>
      prev.find((item) => item.name.toLowerCase() === name.toLowerCase())
        ? prev
        : [...prev, { name }]
    );
  };

  const removeIngredient = (name: string) => {
    setSelectedIngredients((prev) => prev.filter((item) => item.name !== name));
  };

  const addSeasoning = (name: string) => {
    const normalized = name.trim();
    if (!normalized) return;
    setSeasoningQuery("");
    setCustomSeasoning("");
    setSelectedSeasonings((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === normalized.toLowerCase());
      return exists ? prev : [...prev, normalized];
    });
  };

  const removeSeasoning = (name: string) => {
    setSelectedSeasonings((prev) => prev.filter((item) => item !== name));
  };

  const updateNote = (index: number, note: string) => {
    setSelectedIngredients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], note: note.trim() || undefined };
      return next;
    });
  };

  const handleGenerate = async () => {
    setState({ loading: true });

    try {
      const response = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: selectedIngredients,
          mealType,
          dietaryFocus,
          servings,
          extraIngredientAllowance,
          seasonings: selectedSeasonings,
          notes: notes.trim() || undefined,
        } satisfies RecipeRequestPayload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Failed to generate recipe.");
      }

      setState({
        loading: false,
        error: undefined,
        recipe: data.recipe,
        raw: data.raw,
      });
    } catch (error) {
      setState({
        loading: false,
        recipe: undefined,
        raw: undefined,
        error: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  };

  const reset = () => {
    setState({ loading: false });
    setSelectedIngredients([]);
    setSelectedSeasonings([]);
    setQuery("");
    setCustomIngredient("");
    setSeasoningQuery("");
    setCustomSeasoning("");
    setNotes("");
    setExtraIngredientAllowance(0);
  };

  const canGenerate = selectedIngredients.length > 0 && !state.loading;

  const formatNutritionValue = (value?: string) => {
    if (!value) return "N/A";
    const trimmed = value.trim();
    return trimmed ? trimmed : "N/A";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 px-4 py-10 font-sans text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="rounded-3xl border border-emerald-100 bg-white/80 p-8 shadow-lg shadow-emerald-100/40 backdrop-blur">
          <div className="flex flex-col gap-3">
            <span className="inline-flex max-w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
              Vegan Pantry Chef
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Cook Something From What You Have
            </h1>
            <p className="max-w-2xl text-base text-slate-600">
              Tell the assistant what is in your kitchen and instantly receive a
              nutritionally balanced, whole-food, plant-based recipe. Built with
              a free large language model and tailored to your pantry.
            </p>
          </div>
        </header>

        <main className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <section className="space-y-8">
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm shadow-emerald-100/30 backdrop-blur">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-900">Ingredients on hand</h2>
                <p className="text-sm text-slate-500">
                  Search your staples or add custom ingredients. Add quick notes like “canned” or “leftover”.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search spinach, chickpeas, quinoa..."
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  {query && (
                    <div className="absolute left-0 right-0 top-[110%] z-20 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {filteredIngredients.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-slate-500">No matches found.</p>
                      ) : (
                        filteredIngredients.map((item) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => addIngredient(item.name)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-emerald-50"
                          >
                            <span>{item.name}</span>
                            <span className="text-xs uppercase tracking-wide text-slate-400">
                              {item.category}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customIngredient}
                    onChange={(event) => setCustomIngredient(event.target.value)}
                    placeholder="Add custom"
                    className="w-40 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => customIngredient.trim() && addIngredient(customIngredient.trim())}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    disabled={!customIngredient.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>

              {selectedIngredients.length > 0 && (
                <div className="mt-4 space-y-3">
                  {selectedIngredients.map((ingredient, index) => (
                    <div
                      key={ingredient.name}
                      className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex flex-1 flex-col gap-1">
                        <span className="text-sm font-semibold text-slate-800">{ingredient.name}</span>
                        <input
                          type="text"
                          value={ingredient.note ?? ""}
                          onChange={(event) => updateNote(index, event.target.value)}
                          placeholder="Add note (e.g., canned, frozen, needs to be used today)"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 shadow-inner focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeIngredient(ingredient.name)}
                        className="self-start rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-100 hover:bg-emerald-50 md:self-center"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm shadow-emerald-100/30 backdrop-blur">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-900">Seasonings to feature</h2>
                <p className="text-sm text-slate-500">
                  Optional: highlight herbs, spices, or condiments you want the chef to work in.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={seasoningQuery}
                    onChange={(event) => setSeasoningQuery(event.target.value)}
                    placeholder="Search basil, cumin, smoked paprika..."
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  {seasoningQuery && (
                    <div className="absolute left-0 right-0 top-[110%] z-20 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {filteredSeasonings.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-slate-500">No matches found.</p>
                      ) : (
                        filteredSeasonings.map((item) => {
                          const alreadySelected = selectedSeasonings.some(
                            (seasoning) => seasoning.toLowerCase() === item.name.toLowerCase()
                          );
                          return (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => addSeasoning(item.name)}
                              disabled={alreadySelected}
                              className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-emerald-50 ${
                                alreadySelected ? "cursor-not-allowed text-slate-400" : "text-slate-700"
                              }`}
                            >
                              <span>{item.name}</span>
                              <span className="text-xs uppercase tracking-wide text-slate-400">Seasoning</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customSeasoning}
                    onChange={(event) => setCustomSeasoning(event.target.value)}
                    placeholder="Add custom"
                    className="w-40 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => addSeasoning(customSeasoning)}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    disabled={!customSeasoning.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>

              {selectedSeasonings.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedSeasonings.map((seasoning) => (
                    <button
                      key={seasoning}
                      type="button"
                      onClick={() => removeSeasoning(seasoning)}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                    >
                      <span>{seasoning}</span>
                      <span aria-hidden="true">×</span>
                      <span className="sr-only">Remove {seasoning}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm shadow-emerald-100/30 backdrop-blur md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">Meal focus</label>
                <div className="flex flex-wrap gap-2">
                  {mealTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMealType(type)}
                      className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                        mealType === type
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">Dietary focus</label>
                <div className="flex flex-wrap gap-2">
                  {dietaryFocuses.map((focus) => (
                    <button
                      key={focus}
                      type="button"
                      onClick={() => setDietaryFocus(focus)}
                      className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                        dietaryFocus === focus
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-200"
                      }`}
                    >
                      {focus}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="servings" className="text-sm font-semibold text-slate-900">
                  Servings
                </label>
                <input
                  id="servings"
                  type="number"
                  min={1}
                  max={6}
                  value={servings}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    const next = Number.isFinite(value) ? Math.min(6, Math.max(1, value)) : 1;
                    setServings(next);
                  }}
                  className="w-24 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="extra-ingredients" className="text-sm font-semibold text-slate-900">
                  Extra ingredients allowance
                </label>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>Let the chef add up to</span>
                    <span className="text-emerald-700">{extraIngredientAllowance} {extraIngredientAllowance === 1 ? "ingredient" : "ingredients"}</span>
                  </div>
                  <input
                    id="extra-ingredients"
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={extraIngredientAllowance}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setExtraIngredientAllowance(
                        Number.isFinite(next) ? Math.max(0, Math.min(5, Math.round(next))) : 0
                      );
                    }}
                    className="mt-3 w-full accent-emerald-600"
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    Allows the assistant to introduce unlisted pantry staples when they improve the recipe.
                  </p>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-slate-900">Notes for the chef</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Tell the assistant about appliances you have, flavors you love, time limits, allergies, etc."
                  rows={3}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-3xl border border-emerald-200 bg-emerald-600/10 p-6 shadow-inner shadow-emerald-200/50 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-900">Healthy, balanced, vegan results</p>
                <p className="text-xs text-emerald-800/80">
                  Powered by a free Groq large language model. Keep your API key safe by storing it in <code className="rounded bg-emerald-900/10 px-1 py-0.5 text-[10px]">.env.local</code>.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-2xl border border-transparent px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {state.loading ? "Generating..." : "Generate recipe"}
                </button>
              </div>
            </div>
          </section>

          <section className="flex min-h-[480px] flex-col gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-emerald-100/30 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Your vegan recipe</h2>
              {state.recipe && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="text-xs font-semibold text-emerald-700 underline underline-offset-4"
                >
                  Regenerate
                </button>
              )}
            </div>

            {state.loading && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                <p className="text-sm font-medium text-slate-700">Balancing nutrients and drafting instructions...</p>
              </div>
            )}

            {!state.loading && state.error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
                {state.error}
              </div>
            )}

            {!state.loading && !state.error && state.recipe && (
              <div className="flex-1 overflow-y-auto pr-2 text-sm">
                <article className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold text-emerald-800">{state.recipe.title}</h3>
                    <p className="text-sm text-slate-600">{state.recipe.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
                        Serves {state.recipe.servings}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
                        Prep {state.recipe.prepTime}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
                        Cook {state.recipe.cookTime}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ingredients</h4>
                    <ul className="mt-2 space-y-2 text-slate-700">
                      {state.recipe.ingredients.map((item, index) => (
                        <li key={`${item.item}-${index}`} className="flex gap-2">
                          <span className="text-emerald-600">•</span>
                          <span>
                            {item.quantity ? <strong className="mr-1 text-slate-800">{item.quantity}</strong> : null}
                            {item.item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Steps</h4>
                    <ol className="mt-2 space-y-3 text-slate-700">
                      {state.recipe.instructions.map((step, index) => (
                        <li key={index} className="flex gap-3">
                          <span className="font-semibold text-emerald-600">{index + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                    <h4 className="text-sm font-semibold text-emerald-800">Nutrition per serving</h4>
                    <table className="w-full border-separate border-spacing-y-1 text-xs text-emerald-800">
                      <tbody className="divide-y divide-emerald-100">
                        <tr>
                          <th scope="row" className="w-1/2 pr-3 text-left font-semibold text-emerald-900">
                            Calories
                          </th>
                          <td className="text-emerald-900">{formatNutritionValue(state.recipe.nutrition.calories)}</td>
                        </tr>
                        <tr>
                          <th scope="row" className="w-1/2 pr-3 text-left">Protein</th>
                          <td className="text-emerald-900">{formatNutritionValue(state.recipe.nutrition.macros.protein)}</td>
                        </tr>
                        <tr>
                          <th scope="row" className="w-1/2 pr-3 text-left">Carbohydrates</th>
                          <td className="text-emerald-900">{formatNutritionValue(state.recipe.nutrition.macros.carbohydrates)}</td>
                        </tr>
                        <tr>
                          <th scope="row" className="w-1/2 pr-3 text-left">Total Fat</th>
                          <td className="text-emerald-900">{formatNutritionValue(state.recipe.nutrition.macros.fats)}</td>
                        </tr>
                        <tr>
                          <th scope="row" className="w-1/2 pr-3 text-left">Saturated Fat</th>
                          <td className="text-emerald-900">{formatNutritionValue(state.recipe.nutrition.macros.saturatedFats)}</td>
                        </tr>
                        <tr>
                          <th scope="row" className="w-1/2 pr-3 text-left">Total Sugars</th>
                          <td className="text-emerald-900">{formatNutritionValue(state.recipe.nutrition.macros.sugars)}</td>
                        </tr>
                        <tr>
                          <th scope="row" className="w-1/2 pr-3 text-left">Fiber</th>
                          <td className="text-emerald-900">{formatNutritionValue(state.recipe.nutrition.macros.fiber)}</td>
                        </tr>
                      </tbody>
                    </table>
                    {state.recipe.nutrition.micros?.length ? (
                      <p className="text-xs text-emerald-700">
                        Micronutrients: {state.recipe.nutrition.micros.join(", ")}
                      </p>
                    ) : null}
                  </div>

                  {state.recipe.tips?.length ? (
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Tips</h4>
                      <ul className="mt-2 space-y-2 text-slate-700">
                        {state.recipe.tips.map((tip, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="text-emerald-600">–</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              </div>
            )}

            {!state.loading && !state.error && !state.recipe && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-slate-500">
                <p className="text-sm font-medium">Add your ingredients and preferences to begin.</p>
                <p className="text-xs">
                  The assistant suggests balanced vegan meals tailored to your pantry and goals.
                </p>
              </div>
            )}
          </section>
        </main>

        {state.raw && (
          <details className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              View raw model output (debug)
            </summary>
            <pre className="mt-3 max-h-64 overflow-auto rounded-2xl bg-slate-900/90 p-4 text-xs text-emerald-100">
              {state.raw}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
