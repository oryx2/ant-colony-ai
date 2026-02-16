import type { Position } from '../config.js';
import type { Environment } from './index.js';
import type { PheromoneSystem } from './index.js';
import { CONFIG } from '../config.js';

// 可视化配置
const SYMBOLS = {
  NEST: '🏠',
  FOOD: '🍯',
  SCOUT: '🔍',
  FORAGER: '🐜',
  QUEEN: '👑',
  EMPTY: '·',
  PHEROMONE_FOOD: '•',
  PHEROMONE_HOME: '◦',
  PHEROMONE_DANGER: '⚠',
};

// 颜色代码（终端）
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

interface AgentPosition {
  id: string;
  role: string;
  position: Position;
}

export class Visualizer {
  private gridSize: number;
  private history: string[] = [];
  private maxHistory = 50;

  constructor(gridSize = CONFIG.GRID_SIZE) {
    this.gridSize = gridSize;
  }

  // 渲染一帧
  render(
    environment: Environment,
    pheromoneSystem: PheromoneSystem,
    agents: AgentPosition[],
    tick: number,
    foodStorage: number
  ): string {
    const lines: string[] = [];
    
    // 标题
    lines.push(`${COLORS.cyan}╔${'═'.repeat(this.gridSize * 2 + 2)}╗${COLORS.reset}`);
    lines.push(`${COLORS.cyan}║${COLORS.reset} 🐜 ANT COLONY SIMULATION ${' '.repeat(this.gridSize * 2 - 24)}Tick: ${tick.toString().padStart(3)} ${COLORS.cyan}║${COLORS.reset}`);
    lines.push(`${COLORS.cyan}╠${'═'.repeat(this.gridSize * 2 + 2)}╣${COLORS.reset}`);

    // 网格
    for (let y = 0; y < this.gridSize; y++) {
      let row = `${COLORS.cyan}║${COLORS.reset} `;
      for (let x = 0; x < this.gridSize; x++) {
        const pos: Position = { x, y };
        const char = this.getCellChar(pos, environment, pheromoneSystem, agents);
        row += char + ' ';
      }
      row += `${COLORS.cyan}║${COLORS.reset}`;
      lines.push(row);
    }

    // 底部边框
    lines.push(`${COLORS.cyan}╚${'═'.repeat(this.gridSize * 2 + 2)}╝${COLORS.reset}`);

    // 状态栏
    lines.push('');
    lines.push(this.renderStatus(agents, pheromoneSystem, foodStorage));
    lines.push(this.renderLegend());

    const output = lines.join('\n');
    this.history.push(output);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return output;
  }

  private getCellChar(
    pos: Position,
    env: Environment,
    pheromones: PheromoneSystem,
    agents: AgentPosition[]
  ): string {
    // 检查是否有 Agent
    const agent = agents.find(a => a.position.x === pos.x && a.position.y === pos.y);
    if (agent) {
      if (agent.role === 'Queen') return `${COLORS.magenta}${SYMBOLS.QUEEN}${COLORS.reset}`;
      if (agent.role === 'Scout') return `${COLORS.yellow}${SYMBOLS.SCOUT}${COLORS.reset}`;
      if (agent.role === 'Forager') return `${COLORS.green}${SYMBOLS.FORAGER}${COLORS.reset}`;
    }

    // 检查是否是巢穴
    if (pos.x === 0 && pos.y === 0) {
      return `${COLORS.cyan}${SYMBOLS.NEST}${COLORS.reset}`;
    }

    // 检查是否有食物
    const cell = env.getCell(pos);
    if (cell && cell.amount > 0) {
      // 根据剩余量选择颜色
      if (cell.amount > 30) return `${COLORS.green}${SYMBOLS.FOOD}${COLORS.reset}`;
      if (cell.amount > 10) return `${COLORS.yellow}${SYMBOLS.FOOD}${COLORS.reset}`;
      return `${COLORS.red}${SYMBOLS.FOOD}${COLORS.reset}`;
    }

    // 检查信息素
    const pheromoneList = pheromones.sense(pos, 0);
    const strongest = pheromoneList[0];
    if (strongest) {
      const intensity = Math.floor(strongest.intensity * 9) + 1;
      if (strongest.type === 'food') {
        return `${COLORS.yellow}${SYMBOLS.PHEROMONE_FOOD}${COLORS.reset}`;
      } else if (strongest.type === 'home') {
        return `${COLORS.blue}${SYMBOLS.PHEROMONE_HOME}${COLORS.reset}`;
      } else if (strongest.type === 'danger') {
        return `${COLORS.red}${SYMBOLS.PHEROMONE_DANGER}${COLORS.reset}`;
      }
    }

    return `${COLORS.gray}${SYMBOLS.EMPTY}${COLORS.reset}`;
  }

  private renderStatus(agents: AgentPosition[], pheromones: PheromoneSystem, foodStorage: number): string {
    const scouts = agents.filter(a => a.role === 'Scout').length;
    const foragers = agents.filter(a => a.role === 'Forager').length;
    const pheromoneCount = pheromones.getAll().length;

    let status = `${COLORS.cyan}状态:${COLORS.reset} `;
    status += `${COLORS.yellow}🔍侦察蚁:${scouts}${COLORS.reset} `;
    status += `${COLORS.green}🐜采集蚁:${foragers}${COLORS.reset} `;
    status += `${COLORS.magenta}🍯储备:${foodStorage}${COLORS.reset} `;
    status += `${COLORS.gray}•信息素:${pheromoneCount}${COLORS.reset}`;

    return status;
  }

  private renderLegend(): string {
    return `${COLORS.gray}图例: ${SYMBOLS.NEST}巢 ${SYMBOLS.FOOD}食物 ${SYMBOLS.QUEEN}蚁后 ${SYMBOLS.SCOUT}侦察 ${SYMBOLS.FORAGER}采集 ${SYMBOLS.PHEROMONE_FOOD}食迹 ${SYMBOLS.PHEROMONE_HOME}归途${COLORS.reset}`;
  }

  // 清空终端并渲染
  clearAndRender(renderFn: () => string): void {
    // ANSI 清屏 + 光标移到顶部
    process.stdout.write('\x1b[2J\x1b[H');
    console.log(renderFn());
  }

  // 保存当前帧到文件
  saveToFile(filepath: string, content: string): void {
    const fs = require('fs');
    fs.writeFileSync(filepath, content);
  }

  // 获取最近的历史
  getHistory(count = 10): string[] {
    return this.history.slice(-count);
  }
}

// 简单的日志可视化（追加模式）
export class LogVisualizer {
  private logs: string[] = [];

  log(message: string, type: 'info' | 'discovery' | 'collection' | 'command' = 'info'): void {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const prefix = {
      info: '📝',
      discovery: '🔍',
      collection: '🍯',
      command: '📢',
    }[type];

    const line = `[${timestamp}] ${prefix} ${message}`;
    this.logs.push(line);
    console.log(line);
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  saveToFile(filepath: string): void {
    const fs = require('fs');
    fs.writeFileSync(filepath, this.logs.join('\n'));
  }
}
