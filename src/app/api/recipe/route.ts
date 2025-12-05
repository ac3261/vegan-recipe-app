import { NextResponse } from "next/server";
import { buildRecipePrompt } from "@/lib/prompt";
import { RecipeRequestPayload, RecipeResponse } from "@/types/recipe";

interface GroqMessage {
  role: "system" | "user";
  content: string;
}

interface GroqChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const MODEL = "llama-3.1-8b-instant";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

function parseRecipe(content: string): { recipe?: RecipeResponse; raw: string } {
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    const firstIndex = cleaned.indexOf("\n");
    const lastIndex = cleaned.lastIndexOf("```");
    if (firstIndex !== -1 && lastIndex !== -1) {
      cleaned = cleaned.slice(firstIndex + 1, lastIndex).trim();
    }
  }

  try {
    const parsed = JSON.parse(cleaned);
    return { recipe: parsed as RecipeResponse, raw: cleaned };
  } catch {
    return { raw: cleaned };
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "Server missing GROQ_API_KEY. Please set it in your environment.",
      },
      { status: 500 }
    );
  }

  let payload: RecipeRequestPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!payload.ingredients || payload.ingredients.length === 0) {
    return NextResponse.json(
      { success: false, error: "Please provide at least one ingredient." },
      { status: 400 }
    );
  }

  const parsedAllowance = Number(payload.extraIngredientAllowance);
  const extraIngredientAllowance = Number.isFinite(parsedAllowance)
    ? Math.max(0, Math.min(5, Math.round(parsedAllowance)))
    : 0;
  payload.extraIngredientAllowance = extraIngredientAllowance;

  const prompt = buildRecipePrompt(payload);

  const messages: GroqMessage[] = [
    {
      role: "system",
      content:
        "You are a culinary assistant who specializes in nutrient-dense, fully vegan cooking. You answer with factual, concise guidance.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as GroqChatResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response from LLM.");
    }

    const { recipe, raw } = parseRecipe(content);

    return NextResponse.json({
      success: true,
      recipe,
      raw,
    });
  } catch (error) {
    console.error("Recipe generation failed", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate recipe.",
      },
      { status: 500 }
    );
  }
}
