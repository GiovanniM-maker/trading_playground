# 🧠 AI Trading Battle Royale

A real-time AI trading simulator MVP built with Next.js, TypeScript, TailwindCSS, and shadcn/ui.

## Features

- **3-Column Layout**: Traders panel, live price chart, and action feed
- **Real-time Simulation**: Auto-updating mock data every few seconds
- **Interactive Controls**: Play/pause and speed controls
- **Dynamic Traders**: Add new AI traders with random strategies
- **Live Action Feed**: Real-time log of all trading actions
- **Dark Mode UI**: Elegant, minimalistic design

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **TailwindCSS**
- **shadcn/ui** components
- **Recharts** for charting
- **Zustand** for state management

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├─ app/
│   ├─ page.tsx          # Main page with 3-column layout
│   ├─ layout.tsx         # Root layout
│   └─ globals.css        # Global styles
├─ components/
│   ├─ ui/                # shadcn/ui components
│   ├─ Header.tsx         # Top header
│   ├─ TraderPanel.tsx    # Left sidebar - traders list
│   ├─ Chart.tsx          # Center - price chart
│   └─ ActionFeed.tsx     # Right sidebar - action feed
├─ store/
│   └─ useSimulationStore.ts  # Zustand store
└─ lib/
    ├─ mockData.ts        # Mock data generators
    └─ utils.ts          # Utility functions
```

## Features Breakdown

### Left Sidebar - Traders Panel
- List of AI traders with balance, return %, strategy, and leverage
- "Add Trader" button to spawn new traders
- Real-time balance updates

### Center - Trading Chart
- Live BTC price chart using Recharts
- Action markers (buy/sell/short) overlaid on chart
- Play/pause and 2x speed controls
- Real-time price updates

### Right Sidebar - Action Feed
- Scrollable log of all trading actions
- Filter by asset (All/BTC/ETH/SOL)
- Shows trader name, action type, asset, price, and PnL

## Mock Data

All data is generated locally with:
- Random price movements (sinusoid + noise)
- Random trading actions from AI traders
- Simulated PnL calculations
- Auto-updating every 3 seconds (configurable speed)

## License

MIT

