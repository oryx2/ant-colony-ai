import { NextResponse } from 'next/server';

// 模拟配置
const GRID_SIZE = 20;
const MAX_TICKS = 50;
const SCOUT_COUNT = 3;
const FORAGER_COUNT = 5;

// 类型定义
interface Position {
  x: number;
  y: number;
}

interface Agent {
  id: string;
  role: string;
  position: Position;
  carrying?: number;
  state?: string;
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

interface Frame {
  tick: number;
  agents: Agent[];
  foodSources: FoodSource[];
  pheromones: Pheromone[];
  foodStorage: number;
}

// 简单的模拟类
class SimpleSimulation {
  private gridSize: number;
  private agents: Agent[] = [];
  private foodSources: FoodSource[] = [];
  private pheromones: Pheromone[] = [];
  private foodStorage = 0;
  private tick = 0;
  private frames: Frame[] = [];

  constructor(gridSize: number) {
    this.gridSize = gridSize;
    this.init();
  }

  private init() {
    // 创建食物源
    for (let i = 0; i < 5; i++) {
      this.foodSources.push({
        id: `food-${i}`,
        position: {
          x: Math.floor(Math.random() * (this.gridSize - 5)) + 5,
          y: Math.floor(Math.random() * this.gridSize),
        },
        amount: Math.floor(Math.random() * 40) + 20,
      });
    }

    // 创建侦察蚁
    for (let i = 0; i < SCOUT_COUNT; i++) {
      this.agents.push({
        id: `scout-${i}`,
        role: 'Scout',
        position: { x: Math.floor(Math.random() * 3), y: Math.floor(Math.random() * 3) },
      });
    }

    // 创建采集蚁
    for (let i = 0; i < FORAGER_COUNT; i++) {
      this.agents.push({
        id: `forager-${i}`,
        role: 'Forager',
        position: { x: 0, y: 0 },
        carrying: 0,
        state: 'seeking',
      });
    }

    // 蚁后
    this.agents.push({
      id: 'queen',
      role: 'Queen',
      position: { x: 0, y: 0 },
    });
  }

  run(): Frame[] {
    for (let t = 0; t < MAX_TICKS; t++) {
      this.tick = t;
      this.update();
      this.decayPheromones();
      this.saveFrame();
    }
    return this.frames;
  }

  private update() {
    // 更新侦察蚁
    this.agents.filter(a => a.role === 'Scout').forEach(scout => {
      this.updateScout(scout);
    });

    // 更新采集蚁
    this.agents.filter(a => a.role === 'Forager').forEach(forager => {
      this.updateForager(forager);
    });
  }

  private updateScout(scout: Agent) {
    // 检查是否发现食物
    const food = this.foodSources.find(
      f => f.position.x === scout.position.x && f.position.y === scout.position.y && f.amount > 0
    );

    if (food) {
      // 标记信息素
      this.markPheromone(scout.position, 'food');
    }

    // 随机移动
    const directions = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    ];
    const dir = directions[Math.floor(Math.random() * directions.length)];
    scout.position.x = Math.max(0, Math.min(this.gridSize - 1, scout.position.x + dir.dx));
    scout.position.y = Math.max(0, Math.min(this.gridSize - 1, scout.position.y + dir.dy));
  }

  private updateForager(forager: Agent) {
    const carrying = forager.carrying || 0;
    const state = forager.state || 'seeking';
    const pos = forager.position;
    const nearHome = pos.x === 0 && pos.y === 0;

    // 状态逻辑
    if (state === 'seeking') {
      const food = this.foodSources.find(
        f => f.position.x === pos.x && f.position.y === pos.y && f.amount > 0
      );
      if (food) {
        forager.state = 'collecting';
      }
    } else if (state === 'collecting' && carrying >= 10) {
      forager.state = 'returning';
    } else if (state === 'returning' && nearHome) {
      // 卸载
      if (carrying > 0) {
        this.foodStorage += carrying;
        forager.carrying = 0;
      }
      forager.state = 'seeking';
    }

    // 执行动作
    if (forager.state === 'collecting') {
      const food = this.foodSources.find(
        f => f.position.x === pos.x && f.position.y === pos.y && f.amount > 0
      );
      if (food) {
        const toCollect = Math.min(10 - carrying, food.amount, 3);
        food.amount -= toCollect;
        forager.carrying = carrying + toCollect;
      }
    }

    // 移动
    const newPos = this.decideForagerMove(forager);
    forager.position = newPos;

    // 返回时标记 home 路径
    if (forager.state === 'returning') {
      this.markPheromone(forager.position, 'home', 0.3);
    }
  }

  private decideForagerMove(forager: Agent): Position {
    const pos = forager.position;
    const state = forager.state || 'seeking';

    if (state === 'returning') {
      // 向巢穴移动
      const dx = pos.x > 0 ? -1 : pos.x < 0 ? 1 : 0;
      const dy = pos.y > 0 ? -1 : pos.y < 0 ? 1 : 0;
      return {
        x: Math.max(0, Math.min(this.gridSize - 1, pos.x + (dx || (Math.random() > 0.5 ? 1 : -1)))),
        y: Math.max(0, Math.min(this.gridSize - 1, pos.y + (dy || (Math.random() > 0.5 ? 1 : -1)))),
      };
    }

    if (state === 'seeking') {
      // 跟随食物信息素或随机探索
      const foodPheromone = this.pheromones
        .filter(p => p.type === 'food')
        .sort((a, b) => b.intensity - a.intensity)[0];

      if (foodPheromone && foodPheromone.intensity > 0.3) {
        const dx = foodPheromone.position.x > pos.x ? 1 : foodPheromone.position.x < pos.x ? -1 : 0;
        const dy = foodPheromone.position.y > pos.y ? 1 : foodPheromone.position.y < pos.y ? -1 : 0;
        return {
          x: Math.max(0, Math.min(this.gridSize - 1, pos.x + (dx || (Math.random() > 0.5 ? 1 : -1)))),
          y: Math.max(0, Math.min(this.gridSize - 1, pos.y + (dy || (Math.random() > 0.5 ? 1 : -1)))),
        };
      }
    }

    // 随机移动
    const directions = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    ];
    const dir = directions[Math.floor(Math.random() * directions.length)];
    return {
      x: Math.max(0, Math.min(this.gridSize - 1, pos.x + dir.dx)),
      y: Math.max(0, Math.min(this.gridSize - 1, pos.y + dir.dy)),
    };
  }

  private markPheromone(pos: Position, type: 'food' | 'home' | 'danger', intensity = 1.0) {
    const existing = this.pheromones.find(
      p => p.type === type && p.position.x === pos.x && p.position.y === pos.y
    );

    if (existing) {
      existing.intensity = Math.min(1.0, existing.intensity + 0.3);
    } else {
      this.pheromones.push({
        type,
        position: { ...pos },
        intensity,
      });
    }
  }

  private decayPheromones() {
    this.pheromones = this.pheromones
      .map(p => ({ ...p, intensity: p.intensity * 0.95 }))
      .filter(p => p.intensity > 0.1);
  }

  private saveFrame() {
    this.frames.push({
      tick: this.tick,
      agents: this.agents.map(a => ({ ...a })),
      foodSources: this.foodSources.map(f => ({ ...f })),
      pheromones: [...this.pheromones],
      foodStorage: this.foodStorage,
    });
  }
}

export async function GET() {
  try {
    const sim = new SimpleSimulation(GRID_SIZE);
    const frames = sim.run();

    return NextResponse.json({
      success: true,
      frames,
      config: {
        gridSize: GRID_SIZE,
        maxTicks: MAX_TICKS,
        scoutCount: SCOUT_COUNT,
        foragerCount: FORAGER_COUNT,
      },
    });
  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { success: false, error: 'Simulation failed' },
      { status: 500 }
    );
  }
}
