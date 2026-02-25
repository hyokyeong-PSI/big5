export interface FacetScore {
  name: string;
  score: number;
}

export interface FactorScore {
  factorName: string;
  totalScore: number;
  facets: FacetScore[];
}

export interface Mission {
  title: string;
  action: string;
}

export interface NeoAnalysisResult {
  scores: FactorScore[];
  interpretation: string;
  strengths: string[];
  weaknesses: string[];
  improvementMethods: string;
  missions: Mission[];
}

export interface FileData {
  name: string;
  mimeType: string;
  base64: string;
}
