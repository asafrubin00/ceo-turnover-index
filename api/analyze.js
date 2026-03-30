module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ error: "OPENAI_API_KEY is not configured" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        max_output_tokens: 260,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "Write crisp executive analysis for a CEO turnover dashboard. Use 2-3 short paragraphs, no bullets, no hype, and only infer from the supplied dashboard summary.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(body),
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: errorText });
      return;
    }

    const data = await response.json();
    const analysis = extractText(data);
    res.status(200).json({ analysis, mode: "OpenAI" });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
};

function extractText(data) {
  if (!data || !Array.isArray(data.output)) return "";
  return data.output
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text)
    .join("\n\n");
}
