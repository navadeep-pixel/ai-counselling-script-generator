import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper for lazy loading GoogleGenAI
let aiClient: GoogleGenAI | null = null;
function getGenAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined in the settings.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API endpoint for generating counselling scripts
app.post("/api/generate", async (req, res) => {
  try {
    const { parentQuery, childAge, programInterest } = req.body;

    if (!parentQuery || !childAge || !programInterest) {
      res.status(400).json({ error: "Missing required fields: parentQuery, childAge, programInterest" });
      return;
    }

    const ai = getGenAI();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are an expert, highly persuasive Admissions Counsellor for active children's educational programs. 
Design a highly tailored calling script and WhatsApp message for this context:
- Parent's Query/Objection: "${parentQuery}"
- Child's Age: ${childAge} years old
- Program Interest: "${programInterest}"

Format requirements:
- Tone: Empathetic, warm, consultative, professional, and persuasive.
- Structure: Address the child's age group and parent's query/concern specifically in each section. Do not list generic text.
- Need Analysis: Provide 3-4 specific open-ended questions targeting this specific program ("${programInterest}") and age group.
- Objection Handling: Tackle "${parentQuery}" directly with specific, proven reasoning (value justification, testimonials style, convenience, or pedagogy) to handle the objection elegantly.
- WhatsApp message: Use bullet points, spaces, and clean emojis suitable for direct professional copy-pasting.`,
      config: {
        systemInstruction: "You are an elite educational counselor who understands parenting psychology. You write natural-sounding, conversational phone scripts that build trust and address concerns without being pushy.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            greeting: {
              type: Type.STRING,
              description: "Warm and professional greeting mentioning the parent interest in the program and making them feel comfortable."
            },
            rapportBuilding: {
              type: Type.STRING,
              description: "Short friendly dialog to build rapport and establish common ground based on the child's age group."
            },
            needAnalysis: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3-4 tailored, open-ended diagnostic questions to understand the parent's pain points and child's traits."
            },
            programIntroduction: {
              type: Type.STRING,
              description: "Persuasive program introduction showing why it's perfect for a child of this specific age."
            },
            objectionHandling: {
              type: Type.STRING,
              description: "Empathetic, highly persuasive objection handling addressing the parent's query directly with value-driven points."
            },
            closing: {
              type: Type.STRING,
              description: "Dynamic closing statement. Call to action to schedule a free trial class or counseling session."
            },
            whatsappMessage: {
              type: Type.STRING,
              description: "Perfect professional copy-paste WhatsApp follow-up message with emojis and clear layout."
            }
          },
          required: ["greeting", "rapportBuilding", "needAnalysis", "programIntroduction", "objectionHandling", "closing", "whatsappMessage"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text returned from Gemini API");
    }

    try {
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", text);
      res.status(500).json({ error: "Invalid JSON response from AI model", raw: text });
    }
  } catch (err: any) {
    console.error("AI Generation Error:", err);
    res.status(500).json({ error: err?.message || "An unexpected error occurred during AI generation" });
  }
});

// Vite Middleware for Full-Stack Hot Reloading & Static File Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
