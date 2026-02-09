// geminiService.ts
import { PersonalityScores, AnalysisResult } from "./types";

type ApiOk<T> = T;
type ApiErr = { error?: string; detail?: string; raw?: string };

async function postJSON<T>(body: any): Promise<ApiOk<T>> {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as any as T & ApiErr;

  if (!res.ok) {
    const msg = (data as any)?.detail || (data as any)?.error || "AI 분석 실패";
    throw new Error(msg);
  }
  return data as T;
}

/** 성격 해석 */
export async function interpretPersonality(scores: PersonalityScores): Promise<AnalysisResult> {
  return postJSON<AnalysisResult>({ kind: "interpret", scores });
}

/** 파일에서 점수 추출(OCR) */
export async function parseScoresFromFile(base64Data: string, mimeType: string): Promise<any | null> {
  try {
    return await postJSON<any>({ kind: "ocr", base64Data, mimeType });
  } catch (e) {
    console.error("Score OCR Error:", e);
    return null;
  }
}
