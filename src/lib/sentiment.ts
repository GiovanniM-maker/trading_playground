import { pipeline } from '@xenova/transformers';
import { NormalizedNews } from './news/normalize';

let sentimentModel: any = null;

const BULLISH_TERMS = [
  'surge', 'soar', 'rally', 'record high', 'upgrade', 'approval', 'etf',
  'burn', 'partnership', 'integration', 'launch', 'uptrend', 'breakout',
  'milestone', 'adoption', 'growth', 'gain', 'profit', 'success', 'positive',
  'optimistic', 'bullish', 'rise', 'increase', 'boost', 'momentum',
];

const BEARISH_TERMS = [
  'plunge', 'crash', 'dump', 'hack', 'exploit', 'ban', 'lawsuit', 'probe',
  'delist', 'downgrade', 'halt', 'rug pull', 'outage', 'decline', 'drop',
  'fall', 'loss', 'negative', 'bearish', 'worry', 'concern', 'risk',
  'warning', 'volatility', 'uncertainty', 'collapse', 'failure',
];

const NEGATIONS = ['not', 'no', 'without', 'never', 'none', "don't", "doesn't", "won't", "isn't", "aren't"];
const INTENSIFIERS = ['record', 'massive', 'sharp', 'sudden', 'extreme', 'huge', 'major', 'significant'];

async function getSentimentModel() {
  if (!sentimentModel) {
    sentimentModel = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', {
      quantized: false,
    });
  }
  return sentimentModel;
}

function ruleBasedSentiment(text: string): { score: number; confidence: number } {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  let bullishScore = 0;
  let bearishScore = 0;
  let intensity = 1;
  
  // Check for negations
  let hasNegation = false;
  for (let i = 0; i < words.length - 1; i++) {
    if (NEGATIONS.includes(words[i])) {
      hasNegation = true;
      break;
    }
  }
  
  // Check for intensifiers
  for (const intensifier of INTENSIFIERS) {
    if (lowerText.includes(intensifier)) {
      intensity = 1.5;
      break;
    }
  }
  
  // Count bullish terms
  for (const term of BULLISH_TERMS) {
    const count = (lowerText.match(new RegExp(term, 'g')) || []).length;
    if (count > 0) {
      bullishScore += count * intensity;
    }
  }
  
  // Count bearish terms
  for (const term of BEARISH_TERMS) {
    const count = (lowerText.match(new RegExp(term, 'g')) || []).length;
    if (count > 0) {
      bearishScore += count * intensity;
    }
  }
  
  // Apply negation flip
  if (hasNegation) {
    [bullishScore, bearishScore] = [bearishScore, bullishScore];
  }
  
  // Normalize scores
  const total = bullishScore + bearishScore;
  const score = total > 0 ? (bullishScore - bearishScore) / (total + 1) : 0;
  const confidence = Math.min(1, total / 10);
  
  return { score: Math.max(-1, Math.min(1, score)), confidence };
}

async function modelBasedSentiment(text: string): Promise<{ score: number; confidence: number }> {
  try {
    const model = await getSentimentModel();
    const result = await model(text);
    
    // Handle different result formats
    let positiveScore = 0;
    let negativeScore = 0;
    
    if (Array.isArray(result)) {
      // Multiple labels
      const positive = result.find((r: any) => 
        r.label === 'POSITIVE' || r.label === 'LABEL_1' || r.label?.toLowerCase().includes('positive')
      );
      const negative = result.find((r: any) => 
        r.label === 'NEGATIVE' || r.label === 'LABEL_0' || r.label?.toLowerCase().includes('negative')
      );
      positiveScore = positive?.score || 0;
      negativeScore = negative?.score || 0;
    } else if (result && typeof result === 'object') {
      // Single result object
      const label = result.label?.toLowerCase() || '';
      const score = result.score || 0;
      if (label.includes('positive') || label.includes('label_1')) {
        positiveScore = score;
      } else if (label.includes('negative') || label.includes('label_0')) {
        negativeScore = score;
      } else {
        // Default: assume positive if score > 0.5
        positiveScore = score > 0.5 ? score : 0;
        negativeScore = score <= 0.5 ? 1 - score : 0;
      }
    }
    
    // Calculate final score: positive - negative, normalized to [-1, 1]
    const total = positiveScore + negativeScore;
    if (total === 0) return { score: 0, confidence: 0.5 };
    
    const score = (positiveScore - negativeScore) / total;
    const confidence = Math.max(positiveScore, negativeScore);
    
    return { 
      score: Math.max(-1, Math.min(1, score)), 
      confidence: Math.max(0, Math.min(1, confidence))
    };
  } catch (error) {
    console.error('Error in model sentiment:', error);
    return { score: 0, confidence: 0.5 };
  }
}

function scoreCrowd(votes?: { positive?: number; negative?: number; important?: number; toxic?: number }): { score: number; confidence: number } {
  if (!votes) return { score: 0, confidence: 0 };
  
  const pos = votes.positive || 0;
  const neg = votes.negative || 0;
  const important = votes.important || 0;
  const toxic = votes.toxic || 0;
  
  const sum = pos + neg + important + toxic;
  if (sum === 0) return { score: 0, confidence: 0 };
  
  const crowdScore = (pos - neg + 0.5 * important - 0.5 * toxic) / (sum + 1);
  const confidence = Math.min(1, sum / 20);
  
  return {
    score: Math.max(-1, Math.min(1, crowdScore)),
    confidence,
  };
}

async function ollamaReasoning(text: string, currentScore: number): Promise<number> {
  const enableOllama = process.env.ENABLE_OLLAMA_REASONING === 'true';
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  
  if (!enableOllama || Math.abs(currentScore) >= 10) {
    return currentScore;
  }
  
  try {
    const prompt = `Analyze this crypto news headline sentiment (respond with only "BULLISH", "NEUTRAL", or "BEARISH"): "${text}"`;
    const samples = [];
    
    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
          prompt,
          stream: false,
        }),
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const data = await response.json();
        const result = data.response?.toUpperCase() || '';
        if (result.includes('BULLISH')) samples.push(1);
        else if (result.includes('BEARISH')) samples.push(-1);
        else samples.push(0);
      }
    }
    
    if (samples.length > 0) {
      const majority = samples.reduce((a, b) => a + b, 0) / samples.length;
      const adjustment = Math.sign(majority) * Math.min(5, Math.abs(majority) * 5);
      return Math.max(-100, Math.min(100, currentScore + adjustment));
    }
  } catch (error) {
    // Ollama not available or error - ignore
    console.debug('Ollama reasoning unavailable:', error);
  }
  
  return currentScore;
}

export async function computeSentiment(
  item: NormalizedNews
): Promise<{ score: number; label: 'Bullish' | 'Neutral' | 'Bearish'; confidence: number }> {
  const text = `${item.title}. ${item.description || ''}`.toLowerCase();
  
  // Rule-based sentiment
  const ruleBased = ruleBasedSentiment(text);
  
  // Model-based sentiment
  const modelBased = await modelBasedSentiment(text);
  
  // Fuse rule-based and model
  const rawScore = 0.6 * ruleBased.score + 0.4 * modelBased.score;
  const rawConfidence = 0.6 * ruleBased.confidence + 0.4 * modelBased.confidence;
  
  // Crowd sentiment (if available)
  const crowd = scoreCrowd(item.votes);
  
  // Final fusion
  let fusedScore = 0.6 * rawScore + 0.4 * (crowd.score || 0);
  const finalConfidence = 0.6 * rawConfidence + 0.4 * (crowd.confidence || 0);
  
  // Optional Ollama reasoning
  fusedScore = await ollamaReasoning(text, fusedScore * 100);
  
  // Map to [-100, 100]
  const score = Math.max(-100, Math.min(100, fusedScore * 100));
  
  // Determine label
  let label: 'Bullish' | 'Neutral' | 'Bearish';
  if (score >= 15) {
    label = 'Bullish';
  } else if (score <= -15) {
    label = 'Bearish';
  } else {
    label = 'Neutral';
  }
  
  return {
    score: Math.round(score),
    label,
    confidence: Math.max(0, Math.min(1, finalConfidence)),
  };
}

