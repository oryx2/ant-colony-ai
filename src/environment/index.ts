import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Pheromone, Position, FoodSource, ColonyState } from '../config.js';
import { CONFIG } from '../config.js';

// 确保输出目录存在
if (!existsSync(CONFIG.OUTPUT_DIR)) {
  mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
}

const PHEROMONE_FILE = join(CONFIG.OUTPUT_DIR, 'pheromones.json');
const COLONY_FILE = join(CONFIG.OUTPUT_DIR, 'colony-state.json');
const LOG_FILE = join(CONFIG.OUTPUT_DIR, 'simulation.log');

// 初始化日志
writeFileSync(LOG_FILE, `[${new Date().toISOString()}] Simulation started\n`, { flag: 'w' });

// 信息素系统
export class PheromoneSystem {
  private pheromones: Pheromone[] = [];

  constructor() {
    this.load();
  }

  // 标记信息素
  mark(position: Position, type: Pheromone['type'], source: string, intensity = 1.0): void {
    // 检查是否已有同类型信息素在附近
    const existing = this.pheromones.find(
      p => p.type === type && this.distance(p.position, position) <= 2
    );

    if (existing) {
      // 强化已有信息素
      existing.intensity = Math.min(1.0, existing.intensity + 0.3);
      existing.timestamp = Date.now();
    } else {
      // 新建信息素
      this.pheromones.push({
        type,
        position: { ...position },
        intensity,
        timestamp: Date.now(),
        source,
      });
    }
    this.save();
  }

  // 感知附近信息素
  sense(position: Position, radius = 3): Pheromone[] {
    return this.pheromones
      .filter(p => this.distance(p.position, position) <= radius)
      .sort((a, b) => b.intensity - a.intensity);
  }

  // 衰减信息素
  decay(): void {
    const now = Date.now();
    this.pheromones = this.pheromones
      .map(p => ({
        ...p,
        intensity: p.intensity * CONFIG.PHEROMONE_DECAY,
      }))
      .filter(p => p.intensity > CONFIG.PHEROMONE_THRESHOLD);
    this.save();
  }

  // 获取最强信息素方向
  getStrongestDirection(from: Position, type: Pheromone['type']): Position | null {
    const relevant = this.pheromones
      .filter(p => p.type === type)
      .sort((a, b) => b.intensity - a.intensity);
    
    if (relevant.length === 0) return null;
    return relevant[0].position;
  }

  private distance(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private save(): void {
    writeFileSync(PHEROMONE_FILE, JSON.stringify(this.pheromones, null, 2));
  }

  private load(): void {
    if (existsSync(PHEROMONE_FILE)) {
      try {
        this.pheromones = JSON.parse(readFileSync(PHEROMONE_FILE, 'utf-8'));
      } catch {
        this.pheromones = [];
      }
    }
  }

  getAll(): Pheromone[] {
    return [...this.pheromones];
  }

  clear(): void {
    this.pheromones = [];
    this.save();
  }
}

// 环境网格
export class Environment {
  private grid: (FoodSource | null)[][];
  private foodSources: Map<string, FoodSource> = new Map();

  constructor() {
    this.grid = Array(CONFIG.GRID_SIZE)
      .fill(null)
      .map(() => Array(CONFIG.GRID_SIZE).fill(null));
    
    // 生成随机食物源
    this.generateFoodSources();
  }

  private generateFoodSources(count = 5): void {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Math.random() * CONFIG.GRID_SIZE);
      const y = Math.floor(Math.random() * CONFIG.GRID_SIZE);
      
      // 避开巢穴位置 (0,0)
      if (x === 0 && y === 0) continue;

      const food: FoodSource = {
        id: `food-${i}`,
        position: { x, y },
        amount: Math.floor(Math.random() * 50) + 10,
      };
      
      this.foodSources.set(food.id, food);
      this.grid[y][x] = food;
    }
  }

  getCell(position: Position): FoodSource | null {
    if (!this.isValidPosition(position)) return null;
    return this.grid[position.y][position.x];
  }

  collectFood(position: Position, amount: number): number {
    const food = this.getCell(position);
    if (!food) return 0;
    
    const collected = Math.min(amount, food.amount);
    food.amount -= collected;
    
    if (food.amount <= 0) {
      this.grid[position.y][position.x] = null;
      this.foodSources.delete(food.id);
    }
    
    return collected;
  }

  isValidPosition(pos: Position): boolean {
    return pos.x >= 0 && pos.x < CONFIG.GRID_SIZE && 
           pos.y >= 0 && pos.y < CONFIG.GRID_SIZE;
  }

  getFoodSources(): FoodSource[] {
    return Array.from(this.foodSources.values());
  }

  // 移动位置
  move(from: Position, direction: string): Position {
    const newPos = { ...from };
    switch (direction) {
      case 'N': newPos.y--; break;
      case 'S': newPos.y++; break;
      case 'E': newPos.x++; break;
      case 'W': newPos.x--; break;
    }
    
    // 边界检查
    newPos.x = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, newPos.x));
    newPos.y = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, newPos.y));
    
    return newPos;
  }
}

// 日志系统
export function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  writeFileSync(LOG_FILE, line, { flag: 'a' });
  console.log(line.trim());
}

// 保存蚁穴状态
export function saveColonyState(state: ColonyState): void {
  writeFileSync(COLONY_FILE, JSON.stringify(state, null, 2));
}
