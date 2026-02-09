
import React, { useState, useRef } from 'react';
import { INITIAL_SCORES } from './constants';
import { PersonalityScores, AnalysisResult } from './types';
import { interpretPersonality, parseScoresFromFile } from './geminiService';
import ScoreChart from './components/ScoreChart';
import { 
  FileText, 
  Upload, 
  BrainCircuit, 
  Sparkles, 
  ShieldAlert, 
  Calendar, 
  Download,
  ArrowRight,
  User,
  Activity,
  File as FileIcon,
  Loader2
} from 'lucide-react';

const App: React.FC = () => {
  const [scores, setScores] = useState<PersonalityScores>(JSON.parse(JSON.stringify(INITIAL_SCORES)));
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'analysis'>('input');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSavingPDF, setIsSavingPDF] = useState(false);
  
  const reportRef = useRef<HTMLDivElement>(null);

  const handleScoreChange = (factorKey: keyof PersonalityScores, index: number | null, value: number) => {
    setScores(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[factorKey]) return prev;
      
      const safeValue = isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
      if (index === null) {
        next[factorKey].score = safeValue;
      } else {
        if (next[factorKey].subFactors[index]) {
          next[factorKey].subFactors[index].score = safeValue;
          const avg = next[factorKey].subFactors.reduce((acc: number, sf: any) => acc + (sf.score || 0), 0) / 6;
          next[factorKey].score = Math.round(avg);
        }
      }
      return next;
    });
  };

  const processFile = async (file: File) => {
    if (!file) return;
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert("지원하지 않는 파일 형식입니다. PDF 또는 이미지 파일을 업로드해주세요.");
      return;
    }

    setUploadLoading(true);
    const reader = new FileReader();
    reader.onerror = () => {
      alert("파일을 읽는 중 오류가 발생했습니다.");
      setUploadLoading(false);
    };
    reader.onload = async (event) => {
  const base64 = event.target?.result as string;

  try {
    const parsed = await parseScoresFromFile(base64, file.type);
    console.log("OCR parsed:", parsed);

    if (!parsed) {
      alert("파일에서 점수를 찾지 못했습니다.");
      return;
    }

    setScores((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const factorKeys: (keyof PersonalityScores)[] = ["N", "E", "O", "A", "C"];

      // ✅ 서버 응답에서 factors 꺼내기
      const rawFactors: Record<string, any> =
        parsed?.factors ??
        parsed?.main_factors ??
        parsed?.norm_factors ??
        {};

      // ✅ "심리적 민감성 (N)" 같은 키를 N/E/O/A/C로 재매핑
      const byLetter: Record<string, any> = {};
      Object.entries(rawFactors).forEach(([label, obj]) => {
        const m = String(label).match(/\((N|E|O|A|C)\)/i);
        if (m) byLetter[m[1].toUpperCase()] = obj;
      });

      // ✅ 하위요인 유의어
      const alias: Record<string, string[]> = {
        "활동": ["활력"],
        "활력": ["활동"],
        "자극": ["열정"],
        "열정": ["자극"],
        "겸손": ["겸양"],
        "겸양": ["겸손"],
        "유능감": ["자신"],
        "자신": ["유능감"],
        "체계": ["질서"],
        "질서": ["체계"],
        "절제": ["자율"],
        "자율": ["절제"],
        "신중": ["숙고"],
        "숙고": ["신중"],
        "불안": ["걱정"],
        "걱정": ["불안"],
      };

      const clamp = (n: any) =>
        typeof n === "number" ? Math.max(0, Math.min(100, n)) : null;

      // ✅ 공백/괄호 제거해서 비교 (이거 중요)
      const norm = (s: string) =>
        String(s || "").replace(/\s+/g, "").replace(/[()]/g, "").trim();

      factorKeys.forEach((k) => {
        const source = byLetter[k];
        if (!source || !next[k]) return;

        // ✅ total / score / t_score 변형 대응
        const total = clamp(source.total ?? source.score ?? source.t_score);
        if (total !== null) next[k].score = total;

        // ✅ sub_scales 대응
        const sub =
          source.sub_scales ??
          source.subScales ??
          source.subFactors ??
          null;

        if (sub && typeof sub === "object") {
          const subObj = sub as Record<string, any>;
          const keys = Object.keys(subObj);

          next[k].subFactors = next[k].subFactors.map((sf: any) => {
            const name = sf.name;

            // 1) 완전 일치
            if (typeof subObj[name] === "number") {
              return { ...sf, score: clamp(subObj[name]) ?? sf.score };
            }

            // 2) 유의어
            for (const a of alias[name] || []) {
              if (typeof subObj[a] === "number") {
                return { ...sf, score: clamp(subObj[a]) ?? sf.score };
              }
            }

            // 3) 정규화 비교
            const hit = keys.find((key) => norm(key) === norm(name));
            const val = hit ? subObj[hit] : undefined;

            return { ...sf, score: clamp(val) ?? sf.score };
          });
        }
      });

      return next;
    });

    alert("파일 분석이 완료되었습니다.");
  } catch (err) {
    console.error(err);
    alert("파일 분석 중 오류가 발생했습니다.");
  } finally {
    setUploadLoading(false);
  }
};

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const interpretation = await interpretPersonality(scores);
      if (interpretation) {
        setResult(interpretation);
        setStep('analysis');
      }
    } catch (error) {
      alert("분석에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    
    setIsSavingPDF(true);
    const element = reportRef.current;
    
    // PDF 전용 스타일 클래스 적용
    element.classList.add('pdf-export-mode');
    
    // 렌더링 안정을 위해 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 500));

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `NEO-PI-3_전문가_리포트_${new Date().toISOString().slice(0,10)}.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        letterRendering: true,
        width: 1000, // 스타일 시트의 너비와 일치시켜 md 레이아웃 유도
        windowWidth: 1000
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    try {
      // @ts-ignore
      await window.html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("PDF 생성 실패:", error);
      alert("PDF 생성 중 오류가 발생했습니다. 브라우저의 '인쇄' 기능을 사용하여 PDF로 저장해 주세요.");
    } finally {
      element.classList.remove('pdf-export-mode');
      setIsSavingPDF(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-50 no-print">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <BrainCircuit size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-800">NEO-PI-3 전문가 해석 시스템</h1>
          </div>
          {step === 'analysis' && (
            <button 
              onClick={() => setStep('input')}
              className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors font-semibold"
            >
              점수 수정하기
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {step === 'input' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <section className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-slate-800">
                <FileText className="text-indigo-500" />
                진단 결과 데이터 입력
              </h2>
              <p className="text-slate-600 mb-6">
                리포트 파일을 드래그하여 업로드하거나, 아래의 입력칸에 **T점수(0~100)**를 직접 입력해 주세요.
              </p>
              
              <div className="flex flex-col md:flex-row gap-4 mb-8">
                <label 
                  className="flex-1 cursor-pointer"
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  <div className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-all duration-200 ${
                    uploadLoading ? 'border-indigo-300 bg-indigo-50' : 
                    isDragging ? 'border-indigo-600 bg-indigo-100 scale-[1.02]' : 
                    'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
                  }`}>
                    {uploadLoading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-indigo-600" size={40} />
                        <span className="text-indigo-600 font-medium">점수 분석 중...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className={`${isDragging ? 'text-indigo-600' : 'text-slate-400'} mb-2`} size={48} />
                        <span className={`font-semibold ${isDragging ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {isDragging ? '여기에 파일을 놓으세요' : '리포트 파일 업로드 (PDF/이미지)'}
                        </span>
                        <p className="text-sm text-slate-400 mt-2 text-center">파일을 드래그 앤 드롭하거나 클릭하여 선택하세요</p>
                      </>
                    )}
                  </div>
                  <input type="file" className="hidden" accept="application/pdf,image/*" onChange={handleFileChange} disabled={uploadLoading} />
                </label>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {(Object.keys(scores) as Array<keyof PersonalityScores>).map((key) => {
                const factor = scores[key];
                return (
                  <div key={key} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                    <div className="p-4 bg-indigo-50/50 border-b flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base">
                        <span className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black">{key}</span>
                        {factor.name}
                      </h3>
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-sm">
                        <span className="text-[9px] text-slate-400 uppercase font-black">Total T</span>
                        <input 
                          type="number" min="0" max="100" value={factor.score}
                          onChange={(e) => handleScoreChange(key, null, parseInt(e.target.value))}
                          className="w-10 text-center font-bold text-indigo-700 focus:outline-none bg-transparent"
                        />
                      </div>
                    </div>
                    <div className="p-4 grid grid-cols-1 gap-y-4">
                      {factor.subFactors.map((sf, idx) => (
                        <div key={sf.name} className="flex flex-col space-y-2 p-3 bg-slate-50/50 rounded-xl border border-transparent hover:border-slate-200 transition-colors">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold text-slate-600">{sf.name}</label>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" min="0" max="100" value={sf.score}
                                onChange={(e) => handleScoreChange(key, idx, parseInt(e.target.value))}
                                className="w-12 text-center text-xs font-bold text-indigo-600 bg-white border border-slate-200 rounded-lg py-1"
                              />
                            </div>
                          </div>
                          <input 
                            type="range" min="0" max="100" value={sf.score}
                            onChange={(e) => handleScoreChange(key, idx, parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-8 left-0 right-0 flex justify-center pb-4 z-40">
              <button 
                onClick={runAnalysis}
                disabled={loading || uploadLoading}
                className="flex items-center gap-3 px-12 py-5 bg-indigo-600 text-white rounded-full font-bold text-lg shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin" />
                    <span>전문가 소견 분석 중...</span>
                  </div>
                ) : (
                  <>
                    <span>전문가 심층 해석 리포트 생성</span>
                    <ArrowRight size={22} />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div ref={reportRef} className="bg-white md:p-8 rounded-2xl shadow-sm border border-slate-100 report-container">
              {/* Profile Header Box */}
              <div className="mb-10 pb-8 border-b-2 border-slate-100 flex flex-col md:flex-row gap-8 items-center bg-white report-header-box">
                <div className="w-full md:w-1/2">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold mb-2">
                    <Activity size={20} /> 성격 구조 분석 프로파일
                  </div>
                  <h2 className="text-4xl font-extrabold text-slate-800 mb-6">내담자 종합 프로파일</h2>
                  <div className="space-y-5">
                     {(Object.keys(scores) as Array<keyof PersonalityScores>).map(k => (
                        <div key={k} className="flex items-center gap-4">
                           <span className="w-24 text-sm font-bold text-slate-600">{scores[k].name.split(' ')[0]}</span>
                           <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                             <div className="h-full bg-indigo-500 rounded-full shadow-sm" style={{ width: `${scores[k].score}%` }} />
                           </div>
                           <span className="w-12 text-right font-mono font-black text-slate-800 text-lg">{scores[k].score}</span>
                        </div>
                     ))}
                  </div>
                </div>
                <div className="w-full md:w-1/2 bg-slate-50 rounded-3xl p-6 flex justify-center items-center">
                  <ScoreChart scores={scores} />
                </div>
              </div>

              {result && (
                <div className="space-y-12">
                  {/* Summary Section */}
                  <section className="bg-white rounded-2xl p-8 prose prose-indigo max-w-none">
                    <div className="flex items-center gap-2 text-indigo-600 font-bold mb-4">
                      <User size={24} /> 
                      <span className="text-xl uppercase tracking-wider">Expert Analysis</span>
                    </div>
                    <h3 className="text-3xl font-black mb-8 text-slate-800 border-l-8 border-indigo-600 pl-6 py-2">심리학적 종합 소견</h3>
                    <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-[11.5pt] bg-indigo-50/30 p-8 rounded-3xl border border-indigo-100/50">
                      {result.overallInterpretation}
                    </div>
                  </section>

                  {/* Strengths & Opportunities Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <section className="bg-white rounded-3xl p-8 border border-emerald-100 shadow-sm shadow-emerald-50">
                      <h3 className="text-2xl font-black mb-8 flex items-center gap-3 text-emerald-700">
                        <Sparkles size={28} className="text-emerald-500" /> 핵심 강점 (Strengths)
                      </h3>
                      <div className="space-y-6">
                        {result.strengths.map((s, idx) => (
                          <div key={idx} className="bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100">
                            <h4 className="font-bold text-emerald-900 mb-2 flex items-center gap-2 text-lg">
                              <span className="w-6 h-6 flex items-center justify-center bg-emerald-600 text-white rounded-full text-xs">{idx + 1}</span>
                              {s.title}
                            </h4>
                            <p className="text-sm text-emerald-800/80 leading-relaxed font-medium">{s.description}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="bg-white rounded-3xl p-8 border border-rose-100 shadow-sm shadow-rose-50">
                      <h3 className="text-2xl font-black mb-8 flex items-center gap-3 text-rose-700">
                        <ShieldAlert size={28} className="text-rose-500" /> 보완 및 리스크 (Opportunities)
                      </h3>
                      <div className="space-y-6">
                        {result.weaknesses.map((w, idx) => (
                          <div key={idx} className="bg-rose-50/50 rounded-2xl p-6 border border-rose-100">
                            <h4 className="font-bold text-rose-900 mb-2 flex items-center gap-2 text-lg">
                              <span className="w-6 h-6 flex items-center justify-center bg-rose-600 text-white rounded-full text-xs">{idx + 1}</span>
                              {w.title}
                            </h4>
                            <p className="text-sm text-rose-800/80 leading-relaxed font-medium">{w.description}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  {/* Coaching Strategies Section */}
                  <section className="bg-white rounded-3xl p-10 border border-indigo-100 shadow-md">
                    <h3 className="text-3xl font-black mb-12 flex items-center gap-3 text-slate-800">
                      <Calendar size={32} className="text-indigo-600" /> 자기계발 및 코칭 전략
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                      <div className="space-y-8">
                        <h4 className="font-black text-indigo-700 mb-6 pb-4 border-b-2 border-indigo-50 flex items-center gap-2 text-xl italic uppercase">
                          Short Term <span className="text-xs font-normal text-slate-400 not-italic ml-2">(1~3 Months)</span>
                        </h4>
                        <div className="space-y-6">
                          {result.strategies.shortTerm.map((s, idx) => (
                            <div key={idx} className="relative pl-10">
                              <div className="absolute left-0 top-1 w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-xs shadow-sm">{idx + 1}</div>
                              <h5 className="font-bold text-lg text-slate-800 mb-1">{s.title}</h5>
                              <p className="text-sm text-slate-600 leading-relaxed">{s.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-8">
                        <h4 className="font-black text-amber-700 mb-6 pb-4 border-b-2 border-amber-50 flex items-center gap-2 text-xl italic uppercase">
                          Long Term <span className="text-xs font-normal text-slate-400 not-italic ml-2">(6+ Months)</span>
                        </h4>
                        <div className="space-y-6">
                          {result.strategies.longTerm.map((s, idx) => (
                            <div key={idx} className="relative pl-10">
                              <div className="absolute left-0 top-1 w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center font-bold text-amber-600 text-xs shadow-sm">{idx + 1}</div>
                              <h5 className="font-bold text-lg text-slate-800 mb-1">{s.title}</h5>
                              <p className="text-sm text-slate-600 leading-relaxed">{s.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex justify-center gap-4 py-16 no-print">
              <button 
                onClick={handleDownloadPDF}
                disabled={isSavingPDF}
                className="flex items-center gap-4 px-12 py-6 bg-slate-900 text-white rounded-3xl font-black text-xl shadow-2xl transition-all hover:bg-black hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                {isSavingPDF ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    <span>리포트 PDF 파일 생성 중...</span>
                  </>
                ) : (
                  <>
                    <Download className="group-hover:bounce-y" size={24} />
                    <span>전문가 리포트 PDF 저장</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
      
      <footer className="bg-slate-50 py-12 border-t no-print">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-xs font-medium">NEO-PI-3 Expert Interpretation Engine v1.0 • Powered by Gemini AI</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
