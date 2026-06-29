import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON requests
app.use(express.json({ limit: "10mb" }));

// Initialize Gemini Client lazily to prevent crash if key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return aiClient;
}

// API: Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API: Gemini-based text recognition and word parsing
app.post("/api/gemini/parse-words", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ error: "请输入需要识别的文本内容" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      console.warn("GEMINI_API_KEY is not set or invalid. Falling back to basic parser.");
      // Graceful local fallback parsing if Gemini is unavailable
      const fallbackCards = parseFallback(text);
      return res.json({
        success: true,
        fallback: true,
        cards: fallbackCards,
        warning: "当前未配置 Gemini API Key（可在 AI Studio 侧边栏的 Secrets 中设置）。已自动使用本地备用算法为您解析。"
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `请从以下用户输入或粘贴的杂乱文本中识别西班牙语单词（或短语/动词词组），并提取其对应的中文翻译和英文翻译。
如果文本中有多个单词，请全部提取出来（最多提取30个）。
返回结果请保持以下属性：
1. word: 西班牙语单词（例如：hablar, mesa, el gato）
2. translationZh: 中文释义（例如：说话，桌子，猫）
3. translationEn: 英文释义（例如：to speak, table, the cat）

用户输入的文本：
"""
${text}
"""`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "提取出的西班牙语单词列表",
          items: {
            type: Type.OBJECT,
            required: ["word", "translationZh", "translationEn"],
            properties: {
              word: {
                type: Type.STRING,
                description: "The Spanish word or short phrase",
              },
              translationZh: {
                type: Type.STRING,
                description: "The direct Chinese translation or meaning",
              },
              translationEn: {
                type: Type.STRING,
                description: "The direct English translation or meaning",
              },
            },
          },
        },
      },
    });

    const resultText = response.text?.trim() || "[]";
    const cards = JSON.parse(resultText);

    res.json({
      success: true,
      cards: cards,
    });
  } catch (error: any) {
    console.error("Gemini parse failed:", error);
    res.status(500).json({
      error: "智能识别失败，请重试",
      details: error.message || error,
    });
  }
});

/**
 * Robust regex-based fallback parser in case the Gemini API is not configured.
 * It looks for lines containing [Spanish word] followed by separators like '-', '=', ':', '/', ' ' and translation fields.
 */
function parseFallback(text: string) {
  const lines = text.split(/\n+/);
  const cards: Array<{ word: string; translationZh: string; translationEn: string }> = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Remove numbers at the beginning like "1. ", "2)", "3 - "
    let cleanLine = line.replace(/^\d+[\s\.\)-]*/, "").trim();

    // Check if there is some common separator: e.g. "hola - hello - 你好" or "hola : hello : 你好"
    const parts = cleanLine.split(/\s*[-=:：，/]\s*/);
    if (parts.length >= 2) {
      const word = parts[0].trim();
      let translationEn = "";
      let translationZh = "";

      if (parts.length >= 3) {
        // Looks like: [Spanish] - [English] - [Chinese]
        translationEn = parts[1].trim();
        translationZh = parts[2].trim();
      } else {
        // Only 2 parts, try to detect which one is Chinese or English
        const secondPart = parts[1].trim();
        if (/[\u4e00-\u9fa5]/.test(secondPart)) {
          translationZh = secondPart;
          translationEn = "Meaning: " + secondPart; // English fallback
        } else {
          translationEn = secondPart;
          translationZh = "释义: " + secondPart; // Chinese fallback
        }
      }

      if (word && (translationZh || translationEn)) {
        cards.push({
          word,
          translationZh: translationZh || "（暂无中文）",
          translationEn: translationEn || "（暂无英文）",
        });
      }
    } else {
      // Just a single word without visible separator, let's treat it as a Spanish word with empty translations
      const word = cleanLine;
      if (word && word.length < 30 && /^[A-Za-zÁáÉéÍíÓóÚúÜüÑñ\s]+$/.test(word)) {
        cards.push({
          word,
          translationZh: "点击修改翻译",
          translationEn: "Click to edit translation",
        });
      }
    }
  }

  // Limit fallback items to max 15
  return cards.slice(0, 15);
}

// Set up Vite development server OR production static serving
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production build from dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to bootstrap server:", err);
});
