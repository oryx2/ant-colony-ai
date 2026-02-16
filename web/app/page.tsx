'use client';

import { useState, useEffect, useCallback } from 'react';

// 符号映射
const SYMBOLS = {
  NEST: '🏠',
  FOOD: '🍯',
  SCOUT: '🔍',
  FORAGER: '🐜',
  QUEEN: '👑',
  EMPTY: '',
  PHEROMONE_FOOD: '•',
  PHEROMONE_HOME: '◦',
};

// 模拟数据类型
interface Position {
  x: number;
  y: number;
}

interface Agent {
  id: string;
  role: string;
  position: Position;
}

interface FoodSource {
  id: string;
  position: Position;
  amount: number;
}

interface Pheromone {
  type: 'food' | 'home' | 'danger';
  position: Position;
  intensity: number;
}

interface SimulationFrame {
  tick: number;
  agents: Agent[];
  foodSources: FoodSource[];
  pheromones: Pheromone[];
  foodStorage: number;
}

const GRID_SIZE = 20;

export default function Home() {
  const [frames, setFrames] = useState<SimulationFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  // 运行模拟
  const runSimulation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simulate');
      const data = await response.json();
      setFrames(data.frames);
      setCurrentFrame(0);
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to run simulation:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 播放动画
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const interval = setInterval(() => {
      setCurrentFrame((prev) => {
        if (prev >= frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isPlaying, frames]);

  // 渲染网格
  const renderGrid = () => {
    if (frames.length === 0) {
      return renderEmptyGrid();
    }

    const frame = frames[currentFrame];
    const grid = [];

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = getCellContent(x, y, frame);
        grid.push(
          <div
            key={`${x}-${y}`}
            className={`cell ${cell.className}`}
            title={cell.tooltip}
          >
            {cell.symbol}
          </div>
        );
      }
    }

    return grid;
  };

  const renderEmptyGrid = () => {
    const grid = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const isNest = x === 0 && y === 0;
        grid.push(
          <div
            key={`${x}-${y}`}
            className={`cell ${isNest ? 'nest' : ''}`}
          >
            {isNest ? SYMBOLS.NEST : ''}
          </div>
        );
      }
    }
    return grid;
  };

  const getCellContent = (x: number, y: number, frame: SimulationFrame) => {
    // 检查 Agent
    const agent = frame.agents.find((a) => a.position.x === x && a.position.y === y);
    if (agent) {
      const symbol = agent.role === 'Scout' ? SYMBOLS.SCOUT :
                    agent.role === 'Forager' ? SYMBOLS.FORAGER :
                    agent.role === 'Queen' ? SYMBOLS.QUEEN : '?';
      return {
        symbol,
        className: agent.role.toLowerCase(),
        tooltip: `${agent.role} ${agent.id}`,
      };
    }

    // 检查食物
    const food = frame.foodSources.find((f) => f.position.x === x && f.position.y === y);
    if (food && food.amount > 0) {
      return {
        symbol: SYMBOLS.FOOD,
        className: 'food',
        tooltip: `Food: ${food.amount}`,
      };
    }

    // 检查信息素
    const pheromone = frame.pheromones.find((p) => p.position.x === x && p.position.y === y);
    if (pheromone) {
      return {
        symbol: pheromone.type === 'food' ? SYMBOLS.PHEROMONE_FOOD : SYMBOLS.PHEROMONE_HOME,
        className: `pheromone-${pheromone.type}`,
        tooltip: `${pheromone.type} pheromone (${Math.round(pheromone.intensity * 100)}%)`,
      };
    }

    // 巢穴
    if (x === 0 && y === 0) {
      return {
        symbol: SYMBOLS.NEST,
        className: 'nest',
        tooltip: 'Nest',
      };
    }

    return { symbol: '', className: '', tooltip: '' };
  };

  const currentStats = frames.length > 0 ? frames[currentFrame] : null;

  return (
    <div className="container">
      <header>
        <h1>🐜 Ant Colony AI Simulation</h1>
        <p>Multi-agent simulation using Vercel AI SDK + Kimi K2.5</p>
      </header>

      <div className="controls">
        <button onClick={runSimulation} disabled={loading}>
          {loading ? 'Running...' : '🚀 Run Simulation'}
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={frames.length === 0}
          className="secondary"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={() => setCurrentFrame(0)}
          disabled={frames.length === 0}
          className="secondary"
        >
          ⏮ Reset
        </button>
      </div>

      {currentStats && (
        <div className="tick-display">
          Tick: {currentStats.tick} / {frames.length}
        </div>
      )}

      <div className="grid-container">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 24px)` }}
        >
          {renderGrid()}
        </div>
      </div>

      {currentStats && (
        <div className="stats">
          <div className="stat-card">
            <h3>Food Storage</h3>
            <div className="value">{currentStats.foodStorage}</div>
          </div>
          <div className="stat-card">
            <h3>Agents</h3>
            <div className="value">{currentStats.agents.length}</div>
          </div>
          <div className="stat-card">
            <h3>Food Sources</h3>
            <div className="value">{currentStats.foodSources.length}</div>
          </div>
          <div className="stat-card">
            <h3>Pheromones</h3>
            <div className="value">{currentStats.pheromones.length}</div>
          </div>
        </div>
      )}

      <div className="legend">
        <div className="legend-item">
          <span className="legend-symbol">{SYMBOLS.NEST}</span>
          <span className="legend-label">Nest</span>
        </div>
        <div className="legend-item">
          <span className="legend-symbol">{SYMBOLS.FOOD}</span>
          <span className="legend-label">Food</span>
        </div>
        <div className="legend-item">
          <span className="legend-symbol">{SYMBOLS.QUEEN}</span>
          <span className="legend-label">Queen</span>
        </div>
        <div className="legend-item">
          <span className="legend-symbol">{SYMBOLS.SCOUT}</span>
          <span className="legend-label">Scout</span>
        </div>
        <div className="legend-item">
          <span className="legend-symbol">{SYMBOLS.FORAGER}</span>
          <span className="legend-label">Forager</span>
        </div>
        <div className="legend-item">
          <span className="legend-symbol">{SYMBOLS.PHEROMONE_FOOD}</span>
          <span className="legend-label">Food Trail</span>
        </div>
        <div className="legend-item">
          <span className="legend-symbol">{SYMBOLS.PHEROMONE_HOME}</span>
          <span className="legend-label">Home Trail</span>
        </div>
      </div>

      <footer>
        <p>
          Powered by <a href="https://github.com/openclaw/openclaw" target="_blank" rel="noopener">OpenClaw</a> +{' '}
          <a href="https://www.moonshot.cn/" target="_blank" rel="noopener">Kimi K2.5</a>
        </p>
        <p>
          <a href="https://github.com/oryx2/ant-colony-ai" target="_blank" rel="noopener">View Source on GitHub</a>
        </p>
      </footer>
    </div>
  );
}
