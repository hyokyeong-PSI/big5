import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { NeoAnalysisResult, FileData, FactorScore } from './types';
import FileUploader from './components/FileUploader';
import ManualEntry from './components/ManualEntry';
import ReportView from './components/ReportView';
import Login from './components/Login';
import { Loader2, LayoutDashboard, FileText, Keyboard, LogOut } from 'lucide-react';

interface User {
  name: string;
  email: string;
  rowIndex: number;
  remainingCount: number;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<NeoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'manual'>('upload');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setUser(null);
    setResult(null);
    setShowLogoutConfirm(false);
  };

  const analyzeData = async (files: FileData[], manualScores?: FactorScore[]) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let parts: any[] = [];

      if (manualScores && manualScores.length > 0) {
        parts.push({ 
          text: `제공된 NEO-PI-3 점수 데이터를 바탕으로 심층 분석을 제공하십시오. 점수: ${JSON.stringify(manualScores)}` 
        });
      } else if (files && files.length > 0) {
        const fileParts = files.map(file => ({
          inlineData: {
            mimeType: file.mimeType,
            data: file.base64
          }
        }));
        parts.push(...fileParts);
        parts.push({ 
          text: "업로드된 이미지에서 모든 요인(Factor)과 하위 요인(Facet)의 점수를 정확히 추출하고, 이를 바탕으로 심층 분석을 수행하십시오." 
        });
      } else {
        throw new Error("분석할 데이터나 파일이 없습니다.");
      }

      const prompt = `
        당신은 세계적인 수준의 임상 심리학자이자 인사 조직 전문가입니다. 
        제공된 NEO-PI-3 성격검사 결과를 바탕으로 '전문가 인사이트 리포트'를 작성하세요.
        
        [데이터 추출 및 구성 지침]
        1. 'scores' 배열에는 반드시 NEO-PI-3의 5대 요인이 다음 순서대로 모두 포함되어야 합니다: [심리적 민감성, 내향/외향성, 인지적 개방성, 대인수용성, 규범지향성].
        2. 각 요인(Factor)은 반드시 6개의 하위 척도(Facet)를 가져야 합니다. (전체 리포트 기준 총 30개 하위 척도 점수 누락 엄금)
        3. 이미지나 텍스트에서 점수가 명시되지 않은 경우, 문맥을 통해 추론하거나 가장 가능성 높은 수치를 기입하여 프로파일을 완성하십시오.
        4. 해석(interpretation)은 5요인의 상호작용(예: 외향성과 대인수용성의 조합 등)을 중심으로 심층적으로 작성합니다.
        5. 반드시 아래 JSON 형식으로 응답하십시오. 응답은 반드시 유효한 JSON이어야 하며, 텍스트 설명 없이 JSON 객체만 반환하십시오.
      `;

      parts.push({ text: prompt });

      console.log("Starting Gemini analysis...");
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [{ parts: parts }],
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scores: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    factorName: { type: Type.STRING },
                    totalScore: { type: Type.NUMBER },
                    facets: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          score: { type: Type.NUMBER }
                        }
                      }
                    }
                  }
                }
              },
              interpretation: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              improvementMethods: { type: Type.STRING },
              missions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    action: { type: Type.STRING }
                  },
                  required: ["title", "action"]
                }
              }
            },
            required: ["scores", "interpretation", "strengths", "weaknesses", "improvementMethods", "missions"]
          }
        }
      });

      console.log("Gemini response received.");
      let jsonStr = response.text || '';
      
      // Clean up markdown code blocks if present
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        const parsedData = JSON.parse(jsonStr);
        
        // Ensure all required arrays exist to prevent .map() errors
        const data: NeoAnalysisResult = {
          scores: parsedData.scores || [],
          interpretation: parsedData.interpretation || "",
          strengths: parsedData.strengths || [],
          weaknesses: parsedData.weaknesses || [],
          improvementMethods: parsedData.improvementMethods || "",
          missions: parsedData.missions || []
        };
        
        setResult(data);
        console.log("Analysis successful.");
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        console.log("Raw response text:", jsonStr);
        throw new Error("분석 결과를 처리하는 중 오류가 발생했습니다. (데이터 형식 오류)");
      }

      if (user) {
        try {
          const usageRes = await fetch('/api/usage/increment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rowIndex: user.rowIndex })
          });
          if (usageRes.ok) {
            const usageData = await usageRes.json();
            setUser({ ...user, remainingCount: usageData.newRemaining });
          }
        } catch (e) {
          console.error('Failed to increment usage:', e);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 md:px-0 bg-slate-50">
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">로그아웃 하시겠습니까?</h3>
            <p className="text-slate-500 mb-6">현재 세션이 종료되며 로그인 페이지로 이동합니다.</p>
            <div className="flex gap-3">
              <button 
                onClick={handleLogout}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors"
              >
                네
              </button>
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="w-full max-w-5xl mb-8 relative">
        <button 
          onClick={() => setShowLogoutConfirm(true)}
          className="absolute right-0 top-0 flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all font-medium"
        >
          <LogOut size={18} />
          <span>로그아웃</span>
        </button>

        <div className="text-center flex flex-col items-center pt-8 md:pt-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <LayoutDashboard size={32} />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">NEO-PI-3 전문가 인사이트</h1>
          </div>
          <p className="text-slate-500 max-w-2xl text-lg font-light text-center">
            심리학 및 HR 전문가를 위한 고도화된 성격 진단 해석 솔루션입니다.<br/>
            리포트를 업로드하거나 점수를 입력하면 AI가 심층 분석 보고서를 생성합니다.
          </p>
          <div className="mt-4 text-sm text-slate-600 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
            <span className="font-semibold">{user.name}</span>님 환영합니다. (잔여 횟수: <span className="font-bold text-indigo-600">{user.remainingCount}</span>회)
          </div>
        </div>
      </header>

      <main className="w-full max-w-5xl">
        {!result ? (
          <div className="bg-white rounded-3xl shadow-xl p-6 md:p-12 border border-slate-100 transition-all duration-500 ease-in-out">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mb-6" />
                <h3 className="text-2xl font-bold text-slate-800 mb-2">데이터 정밀 분석 중...</h3>
                <p className="text-slate-500 text-center animate-pulse">
                  수치를 추출하고 심리학 연구 데이터를 대조하여 상세 리포트를 생성하고 있습니다.<br/>
                  분량이 많아 약 30~60초 정도 소요될 수 있습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex justify-center">
                  <div className="inline-flex p-1 bg-slate-100 rounded-xl">
                    <button 
                      onClick={() => setInputMode('upload')}
                      className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${inputMode === 'upload' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <FileText size={18} /> 리포트 업로드
                    </button>
                    <button 
                      onClick={() => setInputMode('manual')}
                      className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${inputMode === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Keyboard size={18} /> 점수 직접 입력
                    </button>
                  </div>
                </div>

                {inputMode === 'upload' ? (
                  <FileUploader onUpload={(files) => analyzeData(files)} />
                ) : (
                  <ManualEntry onSubmit={(scores) => analyzeData([], scores)} />
                )}

                {error && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm mt-4">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <ReportView data={result} onReset={handleReset} />
        )}
      </main>

      <footer className="mt-16 text-slate-400 text-xs text-center">
        &copy; 2024 Psychology Expert Analysis System. All rights reserved.
      </footer>
    </div>
  );
};

export default App;
