// geminiService.ts
import { PersonalityScores, AnalysisResult } from "./types";

export async function interpretPersonality(scores: PersonalityScores): Promise<AnalysisResult> {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "interpret", scores }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || data?.error || "AI 분석 실패");
  return data as AnalysisResult;
}

export async function parseScoresFromFile(base64Data: string, mimeType: string): Promise<any | null> {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "ocr", base64Data, mimeType }),
  });

  const data = await res.json();
  if (!res.ok) return null;
  return data;
}
