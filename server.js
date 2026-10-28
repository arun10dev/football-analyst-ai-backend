const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(",").map(url => url.trim())
    : true
}));
app.use(express.json({ limit: "20kb" }));

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

app.get("/", (req, res) => {
  res.json({ status: "Football Analyst AI backend is running" });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const situation = req.body?.situation;

    if (typeof situation !== "string" || !situation.trim()) {
      return res.status(400).json({
        error: "Please enter a football tactical situation."
      });
    }

    if (situation.length > 5000) {
      return res.status(400).json({
        error: "Please keep the situation under 5000 characters."
      });
    }

    if (!ai) {
      return res.status(503).json({
        error: "Gemini API is not configured on the backend."
      });
    }

    const prompt = `
You are Football Analyst AI, a football tactics analyst.

Analyze this football situation:
${situation.trim()}

Return ONLY valid JSON with these keys:
{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "adjustments": ["..."],
  "alternatives": ["..."],
  "tradeoffs": ["..."],
  "visualization": null
}

Each section must contain 2-4 specific, useful points.
Be tactically accurate. Explain risks and practical adjustments.
Do not invent match data or claim certainty when context is missing.

When a pitch diagram would genuinely improve the explanation,
return a visualization object instead of null:
{
  "title": "Short tactical diagram title",
  "players": [{"x": 48, "y": 30, "team": "home", "label": "CB"}],
  "arrows": [{"from": [55, 40], "to": [80, 35], "type": "run", "label": "Run"}],
  "lines": [{"from": [48, 0], "to": [48, 100], "label": "Defensive line"}],
  "zones": [{"x": 50, "y": 10, "w": 35, "h": 80, "label": "Space behind"}]
}

Coordinates must be percentages from 0 to 100.
Use team "home" or "away"; arrow type "run", "pass", or "press".
Only include a diagram when it adds real value. Keep all coordinates within pitch boundaries.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.4
      }
    });

    const raw = response.text;
    if (!raw) throw new Error("The AI returned an empty response.");

    const result = JSON.parse(raw);
    const sections = [
      "strengths",
      "weaknesses",
      "adjustments",
      "alternatives",
      "tradeoffs"
    ];

    for (const key of sections) {
      if (!Array.isArray(result[key]) ||
          !result[key].every(item => typeof item === "string")) {
        throw new Error("The AI returned an invalid analysis format.");
      }
    }

    if (result.visualization !== null &&
        typeof result.visualization !== "object") {
      result.visualization = null;
    }

    return res.json(result);
  } catch (error) {
    console.error("Analysis error:", error.message);
    return res.status(502).json({
      error: "Tactical analysis failed. Please try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Football Analyst AI backend running on port ${PORT}`);
});
