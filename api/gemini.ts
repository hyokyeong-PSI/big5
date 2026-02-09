// api/gemini.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

function readBody(req: VercelRequest) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body as any;
}

function safeJsonFromModel(raw: string) {
  const cleaned = (raw || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned || "{}");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

  const body = readBody(req);
  const { kind, scores, base64Data, mimeType } = body ?? {};

  try {
    const ai = new GoogleGenAI({ apiKey });

    // =========================
    // 1) 해석 (interpret)
    // =========================
    if (kind === "interpret") {
      const prompt = `
당신은 세계적인 성격 심리학 전문가이자 비즈니스 코치입니다.
제공된 NEO-PI-3 Big5 성격검사 T점수 데이터를 분석하여 전문적인 상담 리포트를 작성하세요.

T점수 데이터 (T-Score, 0~100):
${JSON.stringify(scores ?? {}, null, 2)}

분석 및 작성 가이드:
1. 종합 해석 (overallInterpretation): 5요인의 상호작용 중심, A4 한 페이지 분량
2. 주요 강점 (strengths): 3가지
3. 보완점 (weaknesses): 3가지
4. 행동 전략 (strategies): 단기/장기 구분

출력 주의사항:
- 반드시 유효한 JSON 형식으로만 응답
- 한국어
`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction:
            "당신은 임상 심리학 전문가입니다. 오직 지정된 JSON 구조로만 응답하며 메타 코멘트를 포함하지 마십시오.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallInterpretation: { type: Type.STRING },
              strengths: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                  required: ["title", "description"],
                },
              },
              weaknesses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                  required: ["title", "description"],
                },
              },
              strategies: {
                type: Type.OBJECT,
                properties: {
                  shortTerm: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                      required: ["title", "description"],
                    },
                  },
                  longTerm: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                      required: ["title", "description"],
                    },
                  },
                },
                required: ["shortTerm", "longTerm"],
              },
            },
            required: ["overallInterpretation", "strengths", "weaknesses", "strategies"],
          },
        },
      });

      const raw = response.text || "";
      try {
        return res.status(200).json(safeJsonFromModel(raw));
      } catch {
        return res.status(500).json({ error: "Model returned invalid JSON", raw });
      }
    }

    // =========================
    // 2) OCR (ocr)
    // =========================
    if (kind === "ocr") {
      const prompt = `
첨부된 NEO-PI-3 성격검사 리포트 이미지/PDF에서 'T점수(T-Score)' 데이터를 추출하십시오.
오직 JSON 데이터만 반환하십시오.
`;

      // ✅ 입력 검증 (이게 없으면 FUNCTION_INVOCATION_FAILED가 쉽게 납니다)
      const rawBase64 = typeof base64Data === "string" ? base64Data : "";
      const data = rawBase64.includes(",") ? rawBase64.split(",")[1] : rawBase64;

      if (!mimeType || typeof mimeType !== "string") {
        return res.status(400).json({ error: "Missing mimeType" });
      }
      if (!data || data.length < 2000) {
        return res.status(400).json({ error: "Missing/too-small base64Data", len: data?.length ?? 0 });
      }

      // ✅ PDF는 용량이 커서 서버리스에서 불안정할 수 있어 임시 가드 (원하면 조정)
      if (mimeType === "application/pdf" && data.length > 2_500_000) {
        return res.status(413).json({ error: "PDF too large. Upload an image or a smaller PDF." });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [{ inlineData: { mimeType, data } }, { text: prompt }],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              N: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, subFactors: { type: Type.ARRAY, items: { type: Type.NUMBER } } } },
              E: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, subFactors: { type: Type.ARRAY, items: { type: Type.NUMBER } } } },
              O: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, subFactors: { type: Type.ARRAY, items: { type: Type.NUMBER } } } },
              A: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, subFactors: { type: Type.ARRAY, items: { type: Type.NUMBER } } } },
              C: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, subFactors: { type: Type.ARRAY, items: { type: Type.NUMBER } } } },
            },
          },
        },
      });

      const raw = response.text || "";
      try {
        return res.status(200).json(safeJsonFromModel(raw));
      } catch {
        return res.status(500).json({ error: "Invalid JSON from model", raw });
      }
    }

    return res.status(400).json({ error: "Unknown kind" });
} catch (e: any) {
  return res.status(500).json({
    error: "Gemini request failed",
    detail: e?.message ?? String(e),
    name: e?.name
  });
}

}
