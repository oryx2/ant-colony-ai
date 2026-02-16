import { generateText, tool, type Tool } from 'ai';
import { z } from 'zod';
import { moonshot, MODEL_NAME, type Position, type Direction, DIRECTIONS } from '../config.js';
import type { Environment, PheromoneSystem } from '../environment/index.js';
import { bus, type MessageBus } from '../communication/bus.js';
import type { AgentMessage } from '../config.js';

// Agent 基类
export abstract class BaseAgent {
  protected id: string;
  protected position: Position;
  protected role: string;
  protected environment: Environment;
  protected pheromoneSystem: PheromoneSystem;
  protected bus: MessageBus;
  protected logBuffer: string[] = [];

  constructor(
    id: string,
    role: string,
    startPosition: Position,
    env: Environment,
    pheromones: PheromoneSystem
  ) {
    this.id = id;
    this.role = role;
    this.position = { ...startPosition };
    this.environment = env;
    this.pheromoneSystem = pheromones;
    this.bus = bus;
    this.setupMessageHandler();
  }

  protected log(message: string): void {
    const entry = `[${this.role} ${this.id}] ${message}`;
    this.logBuffer.push(entry);
    console.log(entry);
  }

  protected setupMessageHandler(): void {
    // 子类可以覆盖以处理特定消息
    this.bus.onMessage(this.id, (msg: AgentMessage) => {
      this.handleMessage(msg);
    });
  }

  protected abstract handleMessage(msg: AgentMessage): void;
  abstract run(): Promise<void>;

  // 通用工具：移动
  protected moveTool(): Tool {
    return tool({
      description: '向指定方向移动一步',
      parameters: z.object({
        direction: z.enum(DIRECTIONS).describe('移动方向：N=北, S=南, E=东, W=西'),
      }),
      execute: async ({ direction }) => {
        const oldPos = { ...this.position };
        this.position = this.environment.move(this.position, direction);
        const cell = this.environment.getCell(this.position);
        this.log(`移动: (${oldPos.x},${oldPos.y}) → (${this.position.x},${this.position.y})`);
        return {
          success: true,
          position: this.position,
          observation: cell ? `发现食物源！剩余: ${cell.amount}` : '空地区',
        };
      },
    });
  }

  // 通用工具：感知信息素
  protected sensePheromoneTool(): Tool {
    return tool({
      description: '感知周围的信息素浓度',
      parameters: z.object({
        radius: z.number().min(1).max(5).default(3).describe('感知半径'),
      }),
      execute: async ({ radius }) => {
        const pheromones = this.pheromoneSystem.sense(this.position, radius);
        return {
          detected: pheromones.length > 0,
          count: pheromones.length,
          strongest: pheromones[0] || null,
          all: pheromones.slice(0, 5),
        };
      },
    });
  }

  // 通用工具：标记信息素
  protected markPheromoneTool(): Tool {
    return tool({
      description: '在当前位置留下信息素标记',
      parameters: z.object({
        type: z.enum(['food', 'home', 'danger']).describe('信息素类型'),
        intensity: z.number().min(0.1).max(1.0).default(1.0).describe('浓度 0.1-1.0'),
      }),
      execute: async ({ type, intensity }) => {
        this.pheromoneSystem.mark(this.position, type, this.id, intensity);
        this.log(`标记信息素: ${type} (强度 ${intensity.toFixed(2)})`);
        return { success: true, position: this.position, type };
      },
    });
  }

  // 发送消息
  protected sendMessage(to: string | undefined, type: AgentMessage['type'], payload: unknown): void {
    bus.send({
      from: this.id,
      to,
      type,
      payload,
      timestamp: Date.now(),
    });
  }

  getId(): string {
    return this.id;
  }

  getPosition(): Position {
    return { ...this.position };
  }

  setPosition(pos: Position): void {
    this.position = { ...pos };
  }

  getRole(): string {
    return this.role;
  }

  // 用于可视化的简化移动（不调用 LLM）
  randomMove(): void {
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
    ];
    const dir = directions[Math.floor(Math.random() * directions.length)];
    this.position.x = Math.max(0, Math.min(19, this.position.x + dir.dx));
    this.position.y = Math.max(0, Math.min(19, this.position.y + dir.dy));
  }
}

// LLM Agent 基类（使用 Kimi）
export abstract class LLMAgent extends BaseAgent {
  protected systemPrompt: string;

  constructor(
    id: string,
    role: string,
    startPosition: Position,
    env: Environment,
    pheromones: PheromoneSystem,
    systemPrompt: string
  ) {
    super(id, role, startPosition, env, pheromones);
    this.systemPrompt = systemPrompt;
  }

  protected async think(prompt: string, tools: Record<string, Tool>): Promise<string> {
    try {
      const result = await generateText({
        model: moonshot(MODEL_NAME),
        system: this.systemPrompt,
        prompt,
        tools,
        maxSteps: 5,
      });

      return result.text || '思考完成';
    } catch (error) {
      this.log(`LLM 错误: ${error}`);
      return '处理出错';
    }
  }
}
