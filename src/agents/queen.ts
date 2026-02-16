import { LLMAgent } from './base.js';
import type { Environment, PheromoneSystem } from '../environment/index.js';
import type { Position, ColonyState, FoodSource } from '../config.js';
import type { AgentMessage } from '../config.js';

// 蚁后 - 中央调度
export class QueenAnt extends LLMAgent {
  private foodStorage = 0;
  private discoveredFood: FoodSource[] = [];
  private ants = {
    scouts: new Set<string>(),
    foragers: new Set<string>(),
  };

  constructor(
    env: Environment,
    pheromones: PheromoneSystem
  ) {
    const systemPrompt = `你是蚁穴的蚁后（Queen）。

职责：
1. 监控蚁穴食物储备
2. 接收侦察蚁的汇报，管理食物源信息
3. 根据需求调度采集蚁
4. 记录蚁群活动

决策逻辑：
- 食物储备 < 50：派出更多采集蚁
- 发现新食物源：通知附近的采集蚁
- 监控整体效率`;

    super('queen', 'Queen', { x: 0, y: 0 }, env, pheromones, systemPrompt);
  }

  protected handleMessage(msg: AgentMessage): void {
    switch (msg.type) {
      case 'discovery':
        this.handleDiscovery(msg);
        break;
      case 'collection':
        this.handleCollection(msg);
        break;
    }
  }

  private handleDiscovery(msg: AgentMessage): void {
    const payload = msg.payload as { type: string; position: Position; amount?: number };
    if (payload.type === 'food' && payload.amount) {
      const existing = this.discoveredFood.find(
        f => f.position.x === payload.position.x && f.position.y === payload.position.y
      );
      if (!existing) {
        this.discoveredFood.push({
          id: `food-${Date.now()}`,
          position: payload.position,
          amount: payload.amount,
          discoveredBy: msg.from,
          discoveredAt: Date.now(),
        });
        this.log(`记录新食物源: (${payload.position.x}, ${payload.position.y}) × ${payload.amount}`);
        
        // 广播给采集蚁
        this.sendMessage(undefined, 'discovery', {
          type: 'food',
          position: payload.position,
          amount: payload.amount,
        });
      }
    }
  }

  private handleCollection(msg: AgentMessage): void {
    const payload = msg.payload as { amount: number; foragerId: string };
    this.foodStorage += payload.amount;
    this.log(`采集完成! +${payload.amount} (总计: ${this.foodStorage})`);
  }

  registerAnt(id: string, role: 'scout' | 'forager'): void {
    if (role === 'scout') {
      this.ants.scouts.add(id);
    } else {
      this.ants.foragers.add(id);
    }
    this.log(`注册 ${role}: ${id}`);
  }

  async run(): Promise<void> {
    this.log('蚁后开始调度');
    
    // 简单的调度循环
    for (let tick = 0; tick < 10; tick++) {
      await new Promise(r => setTimeout(r, 1000));
      
      const status = this.getStatus();
      this.log(`[Tick ${tick}] 储备: ${status.foodStorage}, 蚂蚁: ${status.ants.total}, 已知食物源: ${status.discoveredFood.length}`);
      
      // 调度决策
      if (this.foodStorage < 50 && this.discoveredFood.length > 0) {
        this.log('食物储备低，催促采集！');
        this.sendMessage(undefined, 'command', { action: 'urgent-collection' });
      }
    }
    
    this.log('调度结束');
  }

  getStatus(): ColonyState {
    return {
      foodStorage: this.foodStorage,
      ants: {
        scouts: Array.from(this.ants.scouts),
        foragers: Array.from(this.ants.foragers),
        total: this.ants.scouts.size + this.ants.foragers.size,
      },
      discoveredFood: this.discoveredFood,
      tick: Date.now(),
    };
  }
}
