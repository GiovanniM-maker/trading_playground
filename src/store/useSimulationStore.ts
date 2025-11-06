import { create } from 'zustand';
import { Model, CompletedTrade } from '@/lib/mockModels';
import { 
  generateInitialModels,
  updateModelEquity,
  generateCompletedTrade,
} from '@/lib/mockModels';

interface SimulationState {
  models: Model[];
  completedTrades: CompletedTrade[];
  isPlaying: boolean;
  speed: number;
  chartMode: '$' | '%';
  
  // Actions
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  setChartMode: (mode: '$' | '%') => void;
  updateSimulation: () => void;
  initialize: () => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  models: [],
  completedTrades: [],
  isPlaying: false,
  speed: 1,
  chartMode: '$',

  initialize: () => {
    const models = generateInitialModels();
    set({
      models,
      completedTrades: [],
      isPlaying: true,
    });
  },

  togglePlay: () => {
    set({ isPlaying: !get().isPlaying });
  },

  setSpeed: (speed: number) => {
    set({ speed });
  },

  setChartMode: (mode: '$' | '%') => {
    set({ chartMode: mode });
  },

  updateSimulation: () => {
    const { models } = get();
    
    // Update each model's equity with random variation
    const updatedModels = models.map(model => {
      const change = (Math.random() - 0.45) * 0.01; // Slight upward bias
      const pnl = model.currentBalance * change;
      return updateModelEquity(model, pnl);
    });
    
    // Randomly generate a completed trade
    if (Math.random() > 0.7 && updatedModels.length > 0) {
      const randomModel = updatedModels[Math.floor(Math.random() * updatedModels.length)];
      const newTrade = generateCompletedTrade(randomModel);
      const trades = get().completedTrades;
      set({
        completedTrades: [newTrade, ...trades.slice(0, 99)],
      });
    }
    
    set({ models: updatedModels });
  },
}));
