import React from 'react';
import { FactorScore } from '../types';

interface ScoreDashboardProps {
  scores: FactorScore[];
}

const ScoreDashboard: React.FC<ScoreDashboardProps> = ({ scores }) => {
  return (
    <div className="grid grid-cols-1 gap-6">
      {(scores || []).map((factor, idx) => (
        <div key={`${factor.factorName}-${idx}`} className="space-y-4">
          <div className="flex justify-between items-end">
            <h4 className="font-bold text-slate-700">{factor.factorName}</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">T-Score</span>
              <span className="text-xl font-black text-indigo-600">{factor.totalScore}</span>
            </div>
          </div>
          
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div 
              className={`h-full transition-all duration-1000 ${factor.totalScore >= 65 ? 'bg-red-400' : factor.totalScore >= 55 ? 'bg-indigo-400' : factor.totalScore >= 45 ? 'bg-emerald-400' : factor.totalScore >= 35 ? 'bg-amber-400' : 'bg-slate-400'}`}
              style={{ width: `${Math.min(100, (factor.totalScore / 100) * 100)}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {(factor.facets || []).map((facet) => (
              <div key={facet.name} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">{facet.name}</p>
                <p className="text-sm font-black text-slate-700">{facet.score}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ScoreDashboard;
