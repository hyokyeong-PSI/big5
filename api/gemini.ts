// api/gemini.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

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

/**
 * 모델이 코드블럭/잡텍스트를 섞어도 JSON만 최대한 뽑아 파싱
 */
function safeJsonFromModel(raw: string) {
  const t = (raw || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  const sliced = start >= 0 && end >= 0 && end > start ? t.slice(start, end + 1) : t;

  return JSON.parse(sliced || "{}");
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
      // ✅ 토큰 절감: 들여쓰기 제거
      const compactScores = JSON.stringify(scores ?? {}, null, 0);

      // ✅ 토큰/쿼터 절감 프롬프트 (A4 1페이지 삭제, 글자수 제한)
      const prompt = `
역할: 당신은 산업/조직심리 기반 성격 해석 전문가이자 코치입니다.

입력: 아래는 NEO-PI-3 Big5 T점수(0~100)입니다.
${compactScores}

출력 규칙(매우 중요):
- 반드시 "유효한 JSON"만 출력하세요.
- 다른 텍스트/설명/코드블럭(예: \`\`\`) 금지.

길이 제한(중요):
- overallInterpretation: 700~900자 (한국어, 줄바꿈 가능)
- strengths: 3개 (각 description 1~2문장)
- weaknesses: 3개 (각 description 1~2문장)
- strategies: shortTerm 2개 + longTerm 2개 (각 description 1~2문장)

작성 가이드:
- 5요인의 "조합/상호작용" 포인트를 2~3개만 간결히 언급.
- 단정적 진단/병리화 금지. 업무/일상 맥락 중심.
- 점수 숫자를 반복 나열하지 말 것.

반드시 아래 JSON 구조로만 반환:
{
  "overallInterpretation": "string",
  "strengths": [{"title":"string","description":"string"}],
  "weaknesses": [{"title":"string","description":"string"}],
  "strategies": {
    "shortTerm": [{"title":"string","description":"string"}],
    "longTerm": [{"title":"string","description":"string"}]
  }
}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "오직 JSON만 출력. 코드블럭/설명/여분 텍스트 금지.",
          responseMimeType: "application/json",
          // ✅ 성공률 우선: responseSchema 제거
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
가능하면 N/E/O/A/C 각 요인의 총점과 6개 하위요인의 점수를 추출하세요.
찾을 수 없는 값은 null로 두세요.
오직 JSON 데이터만 반환하십시오.
`;

      // ✅ 입력 검증
      const rawBase64 = typeof base64Data === "string" ? base64Data : "";
      const data = rawBase64.includes(",") ? rawBase64.split(",")[1] : rawBase64;

      if (!mimeType || typeof mimeType !== "string") {
        return res.status(400).json({ error: "Missing mimeType" });
      }
      if (!data || data.length < 2000) {
        return res.status(400).json({ error: "Missing/too-small base64Data", len: data?.length ?? 0 });
      }

      // ✅ PDF는 서버리스에서 불안정할 수 있어 임시 가드
      if (mimeType === "application/pdf" && data.length > 2_500_000) {
        return res.status(413).json({ error: "PDF too large. Upload an image (PNG/JPG) or a smaller PDF." });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [{ inlineData: { mimeType, data } }, { text: prompt }],
        },
        config: {
          systemInstruction: "표에서 점수만 추출해 JSON으로만 출력. 불필요한 텍스트 금지.",
          responseMimeType: "application/json",
          // ✅ OCR도 성공률 우선: responseSchema 제거
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
      name: e?.name,
    });
  }
}
