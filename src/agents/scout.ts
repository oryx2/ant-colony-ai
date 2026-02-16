import { tool } from 'ai';
import { z } from 'zod';
import { LLMAgent } from './base.js';
import type { Environment, PheromoneSystem } from '../environment/index.js';
import type { Position } from '../config.js';
import type { AgentMessage } from '../config.js';

// 侦察蚁 - 探索环境，发现食物
export class ScoutAnt extends LLMAgent {
  private maxExplorationSteps = 20;
  private exploredCells = new Set<string>();

  constructor(
    id: string,
    startPosition: Position,
    env: Environment,
    pheromones: PheromoneSystem
  ) {
    const systemPrompt = `你是蚁穴中的侦察蚁（ID: ${id}）。

任务：探索 ${process.env.GRID_SIZE || 20}x${process.env.GRID_SIZE || 20} 的网格环境，寻找食物源。

行为准则：
1. 优先探索未标记的区域
2. 发现食物时：
   - 立即使用 markPheromone 标记食物位置
   - 向蚁后发送 discovery 消息汇报
3. 探索完成后返回巢穴附近
4. 巢穴位置：(0, 0)

当前位置会实时更新。使用工具行动。`;

    super(id, 'Scout', startPosition, env, pheromones, systemPrompt);
  }

  protected handleMessage(msg: AgentMessage): void {
    if (msg.type === 'command') {
      this.log(`收到命令: ${JSON.stringify(msg.payload)}`);
    }
  }

  async run(): Promise<void> {
    this.log('开始探索任务');

    for (let step = 0; step < this.maxExplorationSteps; step++) {
      const cellKey = `${this.position.x},${this.position.y}`;
      this.exploredCells.add(cellKey);

      const cell = this.environment.getCell(this.position);
      const pheromones = this.pheromoneSystem.sense(this.position, 2);

      const nearbyFood = pheromones.find(p => p.type === 'food');

      const prompt = `第 ${step + 1}/${this.maxExplorationSteps} 步探索
当前位置: (${this.position.x}, ${this.position.y})
当前格子: ${cell ? `发现食物！剩余 ${cell.amount}` : '空地区'}
附近信息素: ${pheromones.length > 0 ? pheromones.map(p => `${p.type}(${p.intensity.toFixed(2)})`).join(', ') : '无'}
已探索: ${this.exploredCells.size} 个格子

决定下一步行动。如果发现了食物，记得标记并汇报。`;

      const result = await this.think(prompt, {
        move: this.moveTool(),
        markPheromone: this.markPheromoneTool(),
        sensePheromone: this.sensePheromoneTool(),
        reportDiscovery: this.reportDiscoveryTool(),
      });

      if (cell && cell.amount > 0) {
        this.log(`发现食物源！位置: (${this.position.x}, ${this.position.y}), 数量: ${cell.amount}`);
        this.pheromoneSystem.mark(this.position, 'food', this.id);
        this.sendMessage('queen', 'discovery', {
          type: 'food',
          position: this.position,
          amount: cell.amount,
          scoutId: this.id,
        });
      }

      // 模拟移动延迟
      await new Promise(r => setTimeout(r, 100));
    }

    this.log('探索任务完成，返回巢穴');
  }

  private reportDiscoveryTool() {
    return tool({
      description: '向蚁后汇报发现',
      parameters: z.object({
        discoveryType: z.enum(['food', 'danger', 'empty']),
        description: z.string(),
      }),
      execute: async ({ discoveryType, description }) => {
        this.sendMessage('queen', 'discovery', {
          type: discoveryType,
          position: this.position,
          description,
          scoutId: this.id,
        });
        return { success: true };
      },
    });
  }
}
