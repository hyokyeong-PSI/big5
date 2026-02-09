
import { PersonalityScores } from './types';

export const INITIAL_SCORES: PersonalityScores = {
  N: {
    key: 'N',
    name: '심리적 민감성 (Negative Sensitivity)',
    score: 50,
    subFactors: [
      { name: '불안', score: 50 },
      { name: '분노', score: 50 },
      { name: '위축', score: 50 },
      { name: '열등', score: 50 },
      { name: '충동', score: 50 },
      { name: '심약', score: 50 }
    ]
  },
  E: {
    key: 'E',
    name: '내향/외향성 (Extraversion)',
    score: 50,
    subFactors: [
      { name: '온정', score: 50 },
      { name: '사교', score: 50 },
      { name: '주장', score: 50 },
      { name: '활동 or 활력', score: 50 },
      { name: '자극 or 열정', score: 50 },
      { name: '낙천', score: 50 }
    ]
  },
  O: {
    key: 'O',
    name: '인지적 개방성 (Openness to Experience)',
    score: 50,
    subFactors: [
      { name: '상상', score: 50 },
      { name: '심미', score: 50 },
      { name: '감정', score: 50 },
      { name: '시도', score: 50 },
      { name: '독창', score: 50 },
      { name: '가치', score: 50 }
    ]
  },
  A: {
    key: 'A',
    name: '대인 수용성 (Agreeableness)',
    score: 50,
    subFactors: [
      { name: '신뢰', score: 50 },
      { name: '솔직', score: 50 },
      { name: '이타', score: 50 },
      { name: '순응', score: 50 },
      { name: '겸손 or 겸양', score: 50 },
      { name: '온유', score: 50 }
    ]
  },
  C: {
    key: 'C',
    name: '규범 지향성 (Conscientiousness)',
    score: 50,
    subFactors: [
      { name: '유능감 or 자신', score: 50 },
      { name: '체계 or 질서', score: 50 },
      { name: '책임감 or 책임', score: 50 },
      { name: '성취', score: 50 },
      { name: '절제 or 자율', score: 50 },
      { name: '신중 or 숙고', score: 50 }
    ]
  }
};
