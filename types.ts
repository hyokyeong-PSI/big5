
export interface SubFactor {
  name: string;
  score: number;
}

export interface Factor {
  key: string;
  name: string;
  score: number;
  subFactors: SubFactor[];
}

export interface PersonalityScores {
  N: Factor; // 심리적 민감성
  E: Factor; // 외향성
  O: Factor; // 개방성
  A: Factor; // 우호성
  C: Factor; // 성실성
}

export interface AnalysisResult {
  overallInterpretation: string;
  strengths: { title: string; description: string }[];
  weaknesses: { title: string; description: string }[];
  strategies: {
    shortTerm: { title: string; description: string }[];
    longTerm: { title: string; description: string }[];
  };
}
