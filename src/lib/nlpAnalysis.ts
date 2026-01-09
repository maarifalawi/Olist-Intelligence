// NLP analysis buat ekstrak tema keluhan dari review text
// pake keyword matching karena simple tapi efektif

import { OrderLevelMart } from './types';

// stopwords bahasa portugal - biar gak ikut ke-count
const PORTUGUESE_STOPWORDS = new Set([
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma',
  'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao',
  'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'há',
  'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso',
  'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem',
  'nas', 'me', 'esse', 'eles', 'estão', 'você', 'tinha', 'foram', 'essa', 'num',
  'nem', 'suas', 'meu', 'às', 'minha', 'têm', 'numa', 'pelos', 'elas', 'havia',
  'seja', 'qual', 'será', 'nós', 'tenho', 'lhe', 'deles', 'essas', 'esses',
  'pelas', 'este', 'fosse', 'dele', 'tu', 'te', 'vocês', 'vos', 'lhes', 'meus',
  'minhas', 'teu', 'tua', 'teus', 'tuas', 'nosso', 'nossa', 'nossos', 'nossas',
  'dela', 'delas', 'esta', 'estes', 'estas', 'aquele', 'aquela', 'aqueles',
  'aquelas', 'isto', 'aquilo', 'estou', 'está', 'estamos', 'estão', 'estive',
  'esteve', 'estivemos', 'estiveram', 'estava', 'estávamos', 'estavam',
  'estivera', 'estivéramos', 'esteja', 'estejamos', 'estejam', 'estivesse',
  'estivéssemos', 'estivessem', 'estiver', 'estivermos', 'estiverem', 'hei',
  'há', 'havemos', 'hão', 'houve', 'houvemos', 'houveram', 'houvera',
  'houvéramos', 'haja', 'hajamos', 'hajam', 'houvesse', 'houvéssemos',
  'houvessem', 'houver', 'houvermos', 'houverem', 'houverei', 'houverá',
  'houveremos', 'houverão', 'houveria', 'houveríamos', 'houveriam', 'sou',
  'somos', 'são', 'era', 'éramos', 'eram', 'fui', 'foi', 'fomos', 'foram',
  'fora', 'fôramos', 'seja', 'sejamos', 'sejam', 'fosse', 'fôssemos', 'fossem',
  'for', 'formos', 'forem', 'serei', 'será', 'seremos', 'serão', 'seria',
  'seríamos', 'seriam', 'tenho', 'tem', 'temos', 'têm', 'tinha', 'tínhamos',
  'tinham', 'tive', 'teve', 'tivemos', 'tiveram', 'tivera', 'tivéramos',
  'tenha', 'tenhamos', 'tenham', 'tivesse', 'tivéssemos', 'tivessem', 'tiver',
  'tivermos', 'tiverem', 'terei', 'terá', 'teremos', 'terão', 'teria',
  'teríamos', 'teriam', 'produto', 'produtos', 'ainda', 'pois', 'bem', 'agora',
  'veio', 'chegou', 'fez', 'fazer', 'vai', 'vou', 'ir', 'boa', 'bom', 'nao', 'ja',
  'so', 'tb', 'tbm', 'pq', 'vc', 'vcs', 'obg', 'obrigado', 'obrigada'
]);

// keyword keluhan per kategori - ini yang bakal di-match
const COMPLAINT_KEYWORDS: Record<string, string[]> = {
  'Atraso/Demora': ['atrasou', 'atraso', 'demora', 'demorou', 'demoras', 'tarde', 'prazo', 'entrega', 'atrasada', 'atrasado', 'semanas', 'dias', 'esperando', 'aguardando'],
  'Produto Danificado': ['danificado', 'quebrado', 'amassado', 'arranhado', 'defeito', 'defeituoso', 'estragado', 'rachado', 'trincado', 'avariado', 'rasgado'],
  'Produto Errado': ['errado', 'diferente', 'trocado', 'incorreto', 'enganado', 'outro', 'divergente', 'descrição'],
  'Qualidade Baixa': ['qualidade', 'ruim', 'péssimo', 'horrível', 'fraco', 'barato', 'falsificado', 'fake', 'porcaria', 'lixo'],
  'Não Recebido': ['recebido', 'chegou', 'extraviado', 'sumiu', 'perdido', 'nunca', 'devolvido', 'correios'],
  'Atendimento': ['atendimento', 'resposta', 'contato', 'vendedor', 'suporte', 'ignorou', 'respondeu', 'comunicação'],
  'Reembolso': ['reembolso', 'devolução', 'devolver', 'estorno', 'dinheiro', 'ressarcimento', 'cancelar', 'cancelamento'],
  'Tamanho/Medidas': ['tamanho', 'pequeno', 'grande', 'medidas', 'dimensões', 'cabe', 'serviu'],
};

export interface KeywordAnalysis {
  keyword: string;
  count: number;
  category: string;
  examples: string[];
}

export interface ThemeAnalysis {
  theme: string;
  count: number;
  percentage: number;
  topKeywords: string[];
  examples: string[];
  examplesWithScore: { text: string; score: number | null }[];
  lateRate?: number;
  lowReviewRate?: number;
}

// bersihin text dan pecah jadi token
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // hapus aksen
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !PORTUGUESE_STOPWORDS.has(word));
}

// ekstrak keyword dari review text
export function extractKeywords(orders: OrderLevelMart[]): KeywordAnalysis[] {
  const keywordCounts = new Map<string, { count: number; category: string; examples: Set<string> }>();
  
  // filter yang punya review text doang
  const ordersWithText = orders.filter(o => o.review_text && o.review_text.trim().length > 0);
  
  for (const order of ordersWithText) {
    const text = order.review_text!;
    const tokens = tokenize(text);
    
    // cek keyword per kategori
    for (const [category, keywords] of Object.entries(COMPLAINT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (tokens.includes(keyword) || text.toLowerCase().includes(keyword)) {
          if (!keywordCounts.has(keyword)) {
            keywordCounts.set(keyword, { count: 0, category, examples: new Set() });
          }
          const entry = keywordCounts.get(keyword)!;
          entry.count++;
          if (entry.examples.size < 3) {
            entry.examples.add(text.slice(0, 200));
          }
        }
      }
    }
  }
  
  return Array.from(keywordCounts.entries())
    .map(([keyword, data]) => ({
      keyword,
      count: data.count,
      category: data.category,
      examples: Array.from(data.examples),
    }))
    .sort((a, b) => b.count - a.count);
}

// analisis tema keluhan
export function analyzeThemes(orders: OrderLevelMart[]): ThemeAnalysis[] {
  const ordersWithText = orders.filter(o => o.review_text && o.review_text.trim().length > 0);
  
  if (ordersWithText.length === 0) {
    return [];
  }
  
  const themeData = new Map<string, {
    orders: OrderLevelMart[];
    keywordHits: Map<string, number>;
  }>();
  
  // inisialisasi tema
  for (const theme of Object.keys(COMPLAINT_KEYWORDS)) {
    themeData.set(theme, { orders: [], keywordHits: new Map() });
  }
  
  // kategorikan order per tema
  for (const order of ordersWithText) {
    const text = order.review_text!.toLowerCase();
    
    for (const [theme, keywords] of Object.entries(COMPLAINT_KEYWORDS)) {
      let matched = false;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          matched = true;
          const data = themeData.get(theme)!;
          data.keywordHits.set(keyword, (data.keywordHits.get(keyword) || 0) + 1);
        }
      }
      if (matched) {
        themeData.get(theme)!.orders.push(order);
      }
    }
  }
  
  // hitung metrik per tema
  return Array.from(themeData.entries())
    .map(([theme, data]) => {
      const count = data.orders.length;
      const percentage = (count / ordersWithText.length) * 100;
      
      // ambil top keywords
      const topKeywords = Array.from(data.keywordHits.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k]) => k);
      
      // hitung late rate per tema
      const deliveredWithLate = data.orders.filter(o => o.late_flag !== null);
      const lateRate = deliveredWithLate.length > 0
        ? deliveredWithLate.filter(o => o.late_flag === 1).length / deliveredWithLate.length * 100
        : undefined;
      
      // hitung low review rate
      const withReview = data.orders.filter(o => o.review_score !== null);
      const lowReviewRate = withReview.length > 0
        ? withReview.filter(o => o.low_review_flag === 1).length / withReview.length * 100
        : undefined;
      
      // ambil contoh review
      const examples = data.orders
        .slice(0, 5)
        .map(o => o.review_text!.slice(0, 150) + (o.review_text!.length > 150 ? '...' : ''));
      
      // ambil contoh review dengan score
      const examplesWithScore = data.orders
        .slice(0, 10)
        .map(o => ({
          text: o.review_text!.slice(0, 200) + (o.review_text!.length > 200 ? '...' : ''),
          score: o.review_score,
        }));
      
      return {
        theme,
        count,
        percentage,
        topKeywords,
        examples,
        examplesWithScore,
        lateRate,
        lowReviewRate,
      };
    })
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count);
}

// bandingin tema antara order late vs on-time
export function compareThemesByLateness(orders: OrderLevelMart[]): {
  theme: string;
  latePercentage: number;
  onTimePercentage: number;
  difference: number;
}[] {
  const delivered = orders.filter(o => 
    o.order_status === 'delivered' && 
    o.late_flag !== null && 
    o.review_text && 
    o.review_text.trim().length > 0
  );
  
  const lateOrders = delivered.filter(o => o.late_flag === 1);
  const onTimeOrders = delivered.filter(o => o.late_flag === 0);
  
  if (lateOrders.length === 0 || onTimeOrders.length === 0) {
    return [];
  }
  
  const results: {
    theme: string;
    latePercentage: number;
    onTimePercentage: number;
    difference: number;
  }[] = [];
  
  for (const [theme, keywords] of Object.entries(COMPLAINT_KEYWORDS)) {
    const countInLate = lateOrders.filter(o => 
      keywords.some(k => o.review_text!.toLowerCase().includes(k))
    ).length;
    
    const countInOnTime = onTimeOrders.filter(o => 
      keywords.some(k => o.review_text!.toLowerCase().includes(k))
    ).length;
    
    const latePercentage = (countInLate / lateOrders.length) * 100;
    const onTimePercentage = (countInOnTime / onTimeOrders.length) * 100;
    
    results.push({
      theme,
      latePercentage,
      onTimePercentage,
      difference: latePercentage - onTimePercentage,
    });
  }
  
  return results.sort((a, b) => b.difference - a.difference);
}

// statistik review text
export function getReviewTextStats(orders: OrderLevelMart[]) {
  const total = orders.filter(o => o.review_count > 0).length;
  const withText = orders.filter(o => o.review_text && o.review_text.trim().length > 0).length;
  const avgLength = orders
    .filter(o => o.review_text)
    .reduce((sum, o, _, arr) => sum + (o.review_text!.length / arr.length), 0);
  
  return {
    totalReviews: total,
    reviewsWithText: withText,
    textCoverage: total > 0 ? (withText / total) * 100 : 0,
    avgTextLength: avgLength,
  };
}
