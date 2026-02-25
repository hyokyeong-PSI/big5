import React from 'react';
import { NeoAnalysisResult } from '../types';
import { FileDown, RefreshCcw, CheckCircle2, Target, Lightbulb, Zap, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ScoreDashboard from './ScoreDashboard';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ReportViewProps {
  data: NeoAnalysisResult;
  onReset: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ data, onReset }) => {
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    
    try {
      setIsDownloading(true);
      console.log("Starting PDF generation...");
      
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: reportRef.current.scrollWidth,
        windowHeight: reportRef.current.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      
      // First page
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
      
      // Subsequent pages if content is longer than one page
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`NEO-PI-3_Expert_Report_${new Date().getTime()}.pdf`);
      console.log("PDF download triggered.");
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("PDF 생성 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <CheckCircle2 className="text-emerald-500" /> 분석 리포트 생성 완료
        </h2>
        <div className="flex gap-3">
          <button 
            onClick={onReset}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
          >
            <RefreshCcw size={16} /> 다시 시작
          </button>
          <button 
            onClick={downloadPDF}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-100 disabled:opacity-70"
          >
            {isDownloading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>생성 중...</span>
              </>
            ) : (
              <>
                <FileDown size={16} />
                <span>PDF 다운로드</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div ref={reportRef} className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        {/* Header Section */}
        <div className="bg-indigo-600 p-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-black mb-2">NEO-PI-3 전문가 인사이트 리포트</h1>
              <p className="opacity-80 font-light">고도화된 성격 분석 및 행동 솔루션</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-60 uppercase tracking-widest mb-1">Report Date</p>
              <p className="font-bold">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-12 space-y-12">
          {/* Scores Section */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
              <h3 className="text-xl font-bold text-slate-800">성격 요인 프로파일</h3>
            </div>
            <ScoreDashboard scores={data.scores} />
          </section>

          {/* Interpretation Section */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
              <h3 className="text-xl font-bold text-slate-800">심층 해석 및 상호작용 분석</h3>
            </div>
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
              <div className="markdown-body">
                <ReactMarkdown>{data.interpretation}</ReactMarkdown>
              </div>
            </div>
          </section>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="bg-emerald-50 rounded-2xl p-8 border border-emerald-100">
              <div className="flex items-center gap-2 mb-6 text-emerald-700">
                <Zap size={24} />
                <h3 className="text-lg font-bold">핵심 강점</h3>
              </div>
              <ul className="space-y-4">
                {(data.strengths || []).map((s, i) => (
                  <li key={i} className="flex gap-3 text-slate-700">
                    <span className="flex-shrink-0 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-emerald-600 border border-emerald-200">{i+1}</span>
                    <span className="text-sm font-medium">{s}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-amber-50 rounded-2xl p-8 border border-amber-100">
              <div className="flex items-center gap-2 mb-6 text-amber-700">
                <Target size={24} />
                <h3 className="text-lg font-bold">주요 보완점</h3>
              </div>
              <ul className="space-y-4">
                {(data.weaknesses || []).map((w, i) => (
                  <li key={i} className="flex gap-3 text-slate-700">
                    <span className="flex-shrink-0 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-amber-600 border border-amber-200">{i+1}</span>
                    <span className="text-sm font-medium">{w}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Improvement Methods */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
              <h3 className="text-xl font-bold text-slate-800">보완점 개선을 위한 전략</h3>
            </div>
            <div className="bg-indigo-50 rounded-2xl p-8 border border-indigo-100">
              <div className="flex gap-4">
                <Lightbulb className="text-indigo-500 shrink-0" size={28} />
                <div className="markdown-body text-indigo-900">
                  <ReactMarkdown>{data.improvementMethods}</ReactMarkdown>
                </div>
              </div>
            </div>
          </section>

          {/* Action Missions */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
              <h3 className="text-xl font-bold text-slate-800">행동 변화를 위한 실천 미션</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(data.missions || []).map((m, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all hover:shadow-lg group">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    {i+1}
                  </div>
                  <h4 className="font-bold text-slate-800 mb-2">{m.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{m.action}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-8 border-t border-slate-100 text-center">
          <p className="text-slate-400 text-xs">본 리포트는 NEO-PI-3 성격검사 결과를 바탕으로 AI에 의해 생성된 전문가용 참고 자료입니다.</p>
        </div>
      </div>
    </div>
  );
};

export default ReportView;
