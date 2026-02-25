import React, { useState } from 'react';
import { FactorScore } from '../types';
import { Keyboard, Plus, Trash2, Save } from 'lucide-react';

interface ManualEntryProps {
  onSubmit: (scores: FactorScore[]) => void;
}

const FACTORS = [
  { name: '심리적 민감성', facets: ['불안', '분노', '위축', '열등', '충동', '심약'] },
  { name: '내향/외향성', facets: ['온정', '사교', '주장', '활동', '자극', '긍정'] },
  { name: '인지적 개방성', facets: ['상상', '심미', '감정', '시도', '독창', '가치'] },
  { name: '대인수용성', facets: ['신뢰', '솔직', '이타', '순응', '겸손', '온유'] },
  { name: '규범지향성', facets: ['유능감', '체계', '책임감', '성취', '절제', '신중'] }
];

const ManualEntry: React.FC<ManualEntryProps> = ({ onSubmit }) => {
  const [scores, setScores] = useState<FactorScore[]>(
    FACTORS.map(f => ({
      factorName: f.name,
      totalScore: 50,
      facets: f.facets.map(name => ({ name, score: 50 }))
    }))
  );

  const handleFactorChange = (fIndex: number, value: number) => {
    const newScores = [...scores];
    newScores[fIndex].totalScore = value;
    setScores(newScores);
  };

  const handleFacetChange = (fIndex: number, facetIndex: number, value: number) => {
    const newScores = [...scores];
    newScores[fIndex].facets[facetIndex].score = value;
    setScores(newScores);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-8">
        {scores.map((factor, fIndex) => (
          <div key={`${factor.factorName}-${fIndex}`} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800">{factor.factorName}</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">T-점수</span>
                <input 
                  type="number" 
                  value={factor.totalScore}
                  onChange={(e) => handleFactorChange(fIndex, parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {factor.facets.map((facet, facetIndex) => (
                <div key={facet.name} className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 text-center truncate">{facet.name}</label>
                  <input 
                    type="number" 
                    value={facet.score}
                    onChange={(e) => handleFacetChange(fIndex, facetIndex, parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-center text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => onSubmit(scores)}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2"
      >
        <Save size={20} /> 입력된 점수로 분석하기
      </button>
    </div>
  );
};

export default ManualEntry;
