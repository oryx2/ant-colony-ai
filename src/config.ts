import { createOpenAI } from '@ai-sdk/openai';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// Moonshot (Kimi) 配置 - OpenAI 兼容模式
export const moonshot = createOpenAI({
  apiKey: process.env.MOONSHOT_API_KEY || '',
  baseURL: 'https://api.moonshot.cn/v1',
});

export const MODEL_NAME = process.env.MODEL_NAME || 'kimi-k2-0905-preview';

// 模拟配置
export const CONFIG = {
  GRID_SIZE: parseInt(process.env.GRID_SIZE || '20'),
  MAX_TURNS: parseInt(process.env.MAX_TURNS || '50'),
  SCOUT_COUNT: parseInt(process.env.SCOUT_COUNT || '3'),
  FORAGER_COUNT: parseInt(process.env.FORAGER_COUNT || '5'),
  OUTPUT_DIR: join(__dirname, '..', '..', 'output'),
  PHEROMONE_DECAY: 0.95,
  PHEROMONE_THRESHOLD: 0.1,
};

// 方向定义
export const DIRECTIONS = ['N', 'S', 'E', 'W'] as const;
export type Direction = typeof DIRECTIONS[number];

// 位置类型
export interface Position {
  x: number;
  y: number;
}

// 信息素类型
export interface Pheromone {
  type: 'food' | 'home' | 'danger';
  position: Position;
  intensity: number;
  timestamp: number;
  source: string;
}

// 食物源
export interface FoodSource {
  id: string;
  position: Position;
  amount: number;
  discoveredBy?: string;
  discoveredAt?: number;
}

// 蚁穴状态
export interface ColonyState {
  foodStorage: number;
  ants: {
    scouts: string[];
    foragers: string[];
    total: number;
  };
  discoveredFood: FoodSource[];
  tick: number;
}

// Agent 消息
export interface AgentMessage {
  from: string;
  to?: string;  // undefined = broadcast
  type: 'discovery' | 'collection' | 'alert' | 'command';
  payload: unknown;
  timestamp: number;
}
