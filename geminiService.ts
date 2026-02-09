
import { GoogleGenAI, Type } from "@google/genai";
import { PersonalityScores, AnalysisResult } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 성격 검사 결과를 심리학 전문가의 시각에서 심층 해석합니다.
 * 복잡한 추론이 필요하므로 gemini-3-pro-preview 모델을 사용합니다.
 */
export async function interpretPersonality(scores: PersonalityScores): Promise<AnalysisResult> {
  const prompt = `
    당신은 세계적인 성격 심리학 전문가이자 비즈니스 코치입니다.
    제공된 NEO-PI-3 Big5 성격검사 T점수 데이터를 분석하여 전문적인 상담 리포트를 작성하세요.
    
    T점수 데이터 (T-Score, 0~100):
    ${JSON.stringify(scores, null, 2)}

    분석 및 작성 가이드:
    1. 종합 해석 (overallInterpretation): 내담자의 성격 구조를 심층적으로 통찰력 있게 분석하십시오. 5가지 요인의 상호작용(예: 높은 성실성과 낮은 민감성이 결합된 경우의 행동 패턴 등)을 중심으로 전문적인 용어를 적절히 섞어 A4 한 페이지 분량으로 작성하십시오.
    2. 주요 강점 (strengths): 일상과 업무 상황에서 발휘될 수 있는 내담자만의 강점 3가지를 도출하십시오.
    3. 보완점 (weaknesses): 업무 효율이나 대인관계에서 걸림돌이 될 수 있는 지점을 3가지 도출하십시오.
    4. 행동 전략 (strategies): 단기(1~3개월)와 장기(6개월 이상)로 나누어 구체적인 행동 과제를 제시하십시오.

    출력 주의사항:
    - 반드시 유효한 JSON 형식으로만 응답하십시오.
    - AI의 생각이나 중간 과정 텍스트를 절대 포함하지 마십시오.
    - 한국어로 작성하십시오.
    - 점수 범위는 0~100 사이임을 인지하십시오.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: "당신은 임상 심리학 전문가입니다. 오직 지정된 JSON 구조로만 응답하며, 텍스트 내에 (Wait, Thinking...) 같은 메타 코멘트를 일절 허용하지 않습니다.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallInterpretation: { type: Type.STRING },
            strengths: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["title", "description"]
              }
            },
            weaknesses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["title", "description"]
              }
            },
            strategies: {
              type: Type.OBJECT,
              properties: {
                shortTerm: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING }
                    },
                    required: ["title", "description"]
                  }
                },
                longTerm: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING }
                    },
                    required: ["title", "description"]
                  }
                }
              },
              required: ["shortTerm", "longTerm"]
            }
          },
          required: ["overallInterpretation", "strengths", "weaknesses", "strategies"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Expert Analysis Error:", e);
    throw e;
  }
}

/**
 * 리포트 파일에서 점수를 추출합니다.
 */
export async function parseScoresFromFile(base64Data: string, mimeType: string): Promise<any | null> {
  const prompt = `
    첨부된 NEO-PI-3 성격검사 리포트 이미지/PDF에서 'T점수(T-Score)' 데이터를 추출하십시오.
    보통 표 형식으로 제공되며, 각 요인과 하위 요인 옆에 숫자로 표시되어 있습니다.
    
    추출 대상 및 유의어 매칭 가이드:
    N(심리적 민감성): 불안, 분노, 위축, 열등, 충동, 심약
    E(내향/외향성): 온정, 사교, 주장, 활동(또는 활력), 자극(또는 열정), 낙천
    O(인지적 개방성): 상상, 심미, 감정, 시도, 독창, 가치
    A(대인 수용성): 신뢰, 솔직, 이타, 순응, 겸손(또는 겸양), 온유
    C(규범 지향성): 유능감(또는 자신), 체계(또는 질서), 책임감(또는 책임), 성취, 절제(또는 자율), 신중(또는 숙고)

    규칙:
    - 각 주요 요인의 총점(Score)과 6개 하위 요인의 점수를 순서대로 찾으십시오.
    - 리포트에서 위 유의어 중 하나라도 일치하면 해당 항목의 점수로 인식하십시오.
    - 점수를 찾을 수 없는 경우 null로 표시하십시오.
    - 오직 JSON 데이터만 반환하십시오.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data.split(",")[1] || base64Data } },
          { text: prompt }
        ]
      },
      config: {
        systemInstruction: "당신은 문서 OCR 및 데이터 구조화 전문가입니다. 한국어 성격검사 결과지에서 요인명 또는 그 유의어에 대응하는 T점수를 정확히 식별하십시오.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            N: { 
              type: Type.OBJECT, 
              properties: { 
                score: { type: Type.NUMBER }, 
                subFactors: { type: Type.ARRAY, items: { type: Type.NUMBER } } 
              }
            },
            E: { 
              type: Type.OBJECT, 
              properties: { 
                score: { type: Type.NUMBER }, 
                subFactors: { type: Type.ARRAY, items: { type: Type.NUMBER } } 
              }
            },
            O: { 
              type: Type.OBJECT, 
              properties: { 
                score: { type: Type.NUMBER }, 
                subFactors: { type: Type.ARRAY, items: { type: Type.NUMBER } } 
              }
            },
            A: { 
              type: Type.OBJECT, 
              properties: { 
                score: { type: Type.NUMBER }, 
                subFactors: { type: Type.ARRAY, items: { type: Type.NUMBER } } 
              }
            },
            C: { 
              type: Type.OBJECT, 
              properties: { 
                score: { type: Type.NUMBER }, 
                subFactors: { type: Type.ARRAY, items: { type: Type.NUMBER } } 
              }
            }
          }
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Score OCR Error:", e);
    return null;
  }
}
