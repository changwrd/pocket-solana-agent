export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const { description } = req.body || {};

  if (
    !description ||
    typeof description !== "string" ||
    description.trim().length === 0
  ) {
    return res.status(400).json({
      error: "Missing 'description' field.",
    });
  }

  if (description.length > 500) {
    return res.status(400).json({
      error: "Description too long.",
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Server misconfigured: missing API key.",
    });
  }

  const systemPrompt = `You convert a plain-English description of a recurring crypto purchase into strict JSON.

Output ONLY a JSON object, nothing else — no markdown, no explanation, no code fences.

Schema:
{"amountUsd": <positive number, whole or decimal, in US dollars>, "frequency": "daily" | "weekly"}

Rules:
- If the person doesn't clearly state an amount, use 10.
- If the person doesn't clearly state a frequency, use "weekly".
- "frequency" must be exactly "daily" or "weekly".
- "amountUsd" must be a plain number, no currency symbols, no commas.
- Never include any field other than amountUsd and frequency.`;

  const GEMINI_MODEL = "gemini-3.5-flash-lite";


  const GEMINI_URL =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            parts: [{ text: description }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 200,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();

      console.error(
        "Gemini API error:",
        response.status,
        errBody
      );

      return res.status(502).json({
        error: "AI provider request failed.",
      });
    }

    const data = await response.json();

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let parsed;

    try {
      const cleaned = text
        .replace(/```json|```/g, "")
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      console.error(
        "Failed to parse AI response as JSON:",
        text
      );

      return res.status(502).json({
        error: "AI response wasn't valid JSON.",
      });
    }

    const amountUsd =
      typeof parsed.amountUsd === "number" &&
      parsed.amountUsd > 0
        ? parsed.amountUsd
        : 10;

    const frequency =
      parsed.frequency === "daily"
        ? "daily"
        : "weekly";

    return res.status(200).json({
      amountUsd,
      frequency,
    });
  } catch (err) {
    console.error("Proxy error:", err);

    return res.status(500).json({
      error: "Unexpected server error.",
    });
  }
}
