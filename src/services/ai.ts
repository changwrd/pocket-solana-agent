import { Frequency } from "@/types";

// Update this if your Vercel project URL ever changes (custom domain, etc).
const PROXY_URL = "https://pocket-ai-proxy.vercel.app/api/structure-rule";

export interface StructuredRule {
  amountUsd: number;
  frequency: Frequency;
}

/**
 * Sends a plain-English description to the backend proxy, which asks an
 * LLM to structure it into { amountUsd, frequency }. The proxy itself
 * clamps and validates the AI's output server-side — this function still
 * double-checks the shape on the way back, since a client should never
 * fully trust a network response either.
 */
export async function structureRuleFromText(
  description: string,
): Promise<StructuredRule> {
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    throw new Error("Describe the rule first — the box is empty.");
  }

  let response: Response;
  try {
    response = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: trimmed }),
    });
  } catch {
    throw new Error(
      "Couldn't reach the AI service — check your internet connection.",
    );
  }

  if (!response.ok) {
    let message = `AI service returned an error (${response.status}).`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // Response wasn't JSON — keep the generic message above.
    }
    throw new Error(message);
  }

  const data = await response.json();

  // Re-validate here too — never fully trust a network response, even one
  // that already claims to be clamped server-side.
  const amountUsd =
    typeof data.amountUsd === "number" && data.amountUsd > 0
      ? data.amountUsd
      : 10;
  const frequency: Frequency = data.frequency === "daily" ? "daily" : "weekly";

  return { amountUsd, frequency };
}
