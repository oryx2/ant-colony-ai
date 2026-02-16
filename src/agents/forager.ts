import { tool } from 'ai';
import { z } from 'zod';
import { LLMAgent } from './base.js';
import type { Environment, PheromoneSystem } from '../environment/index.js';
import type { Position } from '../config.js';
import type { AgentMessage } from '../config.js';

// 采集蚁 - 根据信息素采集食物
export class ForagerAnt extends LLMAgent {
  private carrying = 0;
  private maxCapacity = 10;
  private targetFood: Position | null = null;
  private state: 'seeking' | 'collecting' | 'returning' = 'seeking';

  constructor(
    id: string,
    startPosition: Position,
    env: Environment,
    pheromones: PheromoneSystem
  ) {
    const systemPrompt = `你是蚁穴中的采集蚁（ID: ${id}）。

任务：
1. 根据信息素路径寻找食物源
2. 采集食物并运回巢穴
3. 每次最多携带 ${10} 单位食物

行为准则：
- 优先跟随 food 类型的信息素
- 返回巢穴时标记 home 信息素帮助其他蚂蚁
- 巢穴位置：(0, 0)

状态机：
- seeking: 寻找食物（跟随 food 信息素）
- collecting: 采集食物
- returning: 携带食物返回巢穴`;

    super(id, 'Forager', startPosition, env, pheromones, systemPrompt);
  }

  protected handleMessage(msg: AgentMessage): void {
    if (msg.type === 'discovery' && msg.payload && (msg.payload as { type?: string }).type === 'food') {
      const payload = msg.payload as { position: Position; amount: number };
      this.targetFood = payload.position;
      this.log(`收到食物位置更新: (${this.targetFood.x}, ${this.targetFood.y})`);
    }
  }

  async run(): Promise<void> {
    this.log('开始采集任务');

    let steps = 0;
    const maxSteps = 30;

    while (steps < maxSteps) {
      steps++;

      const cell = this.environment.getCell(this.position);
      const nearHome = this.position.x === 0 && this.position.y === 0;

      // 状态转换逻辑
      if (this.state === 'seeking' && cell && cell.amount > 0) {
        this.state = 'collecting';
      } else if (this.state === 'collecting' && this.carrying >= this.maxCapacity) {
        this.state = 'returning';
      } else if (this.state === 'returning' && nearHome) {
        // 卸载食物，完成任务
        this.log(`返回巢穴，卸载 ${this.carrying} 单位食物`);
        this.sendMessage('queen', 'collection', {
          amount: this.carrying,
          foragerId: this.id,
        });
        this.carrying = 0;
        this.state = 'seeking';
        this.targetFood = null;
      }

      const prompt = `第 ${steps}/${maxSteps} 步
当前位置: (${this.position.x}, ${this.position.y})
状态: ${this.state}
携带: ${this.carrying}/${this.maxCapacity}
当前格子: ${cell ? `食物 ${cell.amount}` : '空地'}
在巢穴: ${nearHome ? '是' : '否'}

决定下一步行动。`;

      const tools: Record<string, ReturnType<typeof tool>> = {
        move: this.moveTool(),
        collectFood: this.collectFoodTool(),
        markPheromone: this.markPheromoneTool(),
        sensePheromone: this.sensePheromoneTool(),
      };

      await this.think(prompt, tools);

      // 执行自动逻辑
      if (this.state === 'collecting' && cell) {
        const amount = Math.min(this.maxCapacity - this.carrying, cell.amount);
        const collected = this.environment.collectFood(this.position, amount);
        this.carrying += collected;
        this.log(`采集 ${collected} 单位食物，当前携带 ${this.carrying}`);
        
        // 标记食物已采集
        this.pheromoneSystem.mark(this.position, 'food', this.id, 0.5);
      }

      // 简单移动策略
      const newPos = this.decideMove();
      if (newPos.x !== this.position.x || newPos.y !== this.position.y) {
        this.position = newPos;
        this.log(`移动至 (${this.position.x}, ${this.position.y})`);
      }

      // 返回时标记 home 路径
      if (this.state === 'returning') {
        this.pheromoneSystem.mark(this.position, 'home', this.id, 0.3);
      }

      await new Promise(r => setTimeout(r, 100));
    }

    this.log('采集任务结束');
  }

  private decideMove(): Position {
    const directions = [
      { dx: 0, dy: -1, name: 'N' },
      { dx: 0, dy: 1, name: 'S' },
      { dx: 1, dy: 0, name: 'E' },
      { dx: -1, dy: 0, name: 'W' },
    ];

    // 根据状态决定方向
    if (this.state === 'returning') {
      // 向巢穴移动
      const dx = this.position.x > 0 ? -1 : this.position.x < 0 ? 1 : 0;
      const dy = this.position.y > 0 ? -1 : this.position.y < 0 ? 1 : 0;
      return {
        x: Math.max(0, Math.min(19, this.position.x + dx)),
        y: Math.max(0, Math.min(19, this.position.y + dy)),
      };
    }

    if (this.state === 'seeking' && this.targetFood) {
      // 向目标食物移动
      const dx = this.targetFood.x > this.position.x ? 1 : this.targetFood.x < this.position.x ? -1 : 0;
      const dy = this.targetFood.y > this.position.y ? 1 : this.targetFood.y < this.position.y ? -1 : 0;
      return {
        x: Math.max(0, Math.min(19, this.position.x + dx)),
        y: Math.max(0, Math.min(19, this.position.y + dy)),
      };
    }

    // 随机移动
    const dir = directions[Math.floor(Math.random() * directions.length)];
    return {
      x: Math.max(0, Math.min(19, this.position.x + dir.dx)),
      y: Math.max(0, Math.min(19, this.position.y + dir.dy)),
    };
  }

  private collectFoodTool() {
    return tool({
      description: '从当前位置采集食物',
      parameters: z.object({
        amount: z.number().min(1).describe('采集数量'),
      }),
      execute: async ({ amount }) => {
        const cell = this.environment.getCell(this.position);
        if (!cell) {
          return { success: false, error: '当前位置没有食物' };
        }
        
        const toCollect = Math.min(amount, this.maxCapacity - this.carrying);
        const collected = this.environment.collectFood(this.position, toCollect);
        this.carrying += collected;
        
        this.log(`采集 ${collected} 单位食物`);
        return { success: true, collected, carrying: this.carrying };
      },
    });
  }
}
