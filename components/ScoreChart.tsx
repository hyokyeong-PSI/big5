
import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis } from 'recharts';
import { PersonalityScores } from '../types';

interface Props {
  scores: PersonalityScores;
}

const ScoreChart: React.FC<Props> = ({ scores }) => {
  if (!scores || !scores.N || !scores.E || !scores.O || !scores.A || !scores.C) {
    return <div className="flex items-center justify-center h-full text-slate-400">데이터를 구성하는 중...</div>;
  }

  const data = [
    { subject: '민감성', A: scores.N.score, fullMark: 100 },
    { subject: '외향성', A: scores.E.score, fullMark: 100 },
    { subject: '개방성', A: scores.O.score, fullMark: 100 },
    { subject: '수용성', A: scores.A.score, fullMark: 100 },
    { subject: '규범성', A: scores.C.score, fullMark: 100 },
  ];

  return (
    <div className="w-full h-72 md:h-96 min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="성격 프로파일"
            dataKey="A"
            stroke="#4f46e5"
            strokeWidth={3}
            fill="#6366f1"
            fillOpacity={0.4}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScoreChart;
