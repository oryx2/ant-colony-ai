import { ScoutAnt } from './agents/scout.js';
import { ForagerAnt } from './agents/forager.js';
import { QueenAnt } from './agents/queen.js';
import { Environment, PheromoneSystem, log, saveColonyState } from './environment/index.js';
import { Visualizer } from './environment/visualizer.js';
import { CONFIG } from './config.js';
import { join } from 'path';
import { writeFileSync } from 'fs';

async function main() {
  log('🐜 蚁穴模拟启动');
  log(`网格大小: ${CONFIG.GRID_SIZE}x${CONFIG.GRID_SIZE}`);
  log(`侦察蚁: ${CONFIG.SCOUT_COUNT}, 采集蚁: ${CONFIG.FORAGER_COUNT}`);

  // 初始化环境
  const environment = new Environment();
  const pheromoneSystem = new PheromoneSystem();
  const visualizer = new Visualizer();
  
  // 清理之前的信息素
  pheromoneSystem.clear();

  // 显示初始食物分布
  const initialFood = environment.getFoodSources();
  log(`初始食物源: ${initialFood.length} 个`);
  initialFood.forEach(f => {
    log(`  - 位置(${f.position.x}, ${f.position.y}): ${f.amount} 单位`);
  });

  // 创建蚁后
  const queen = new QueenAnt(environment, pheromoneSystem);

  // 创建侦察蚁（随机起始位置）
  const scouts: ScoutAnt[] = [];
  for (let i = 0; i < CONFIG.SCOUT_COUNT; i++) {
    const scout = new ScoutAnt(
      `scout-${i}`,
      { x: Math.floor(Math.random() * 3), y: Math.floor(Math.random() * 3) },
      environment,
      pheromoneSystem
    );
    scouts.push(scout);
    queen.registerAnt(scout.getId(), 'scout');
  }

  // 创建采集蚁（从巢穴出发）
  const foragers: ForagerAnt[] = [];
  for (let i = 0; i < CONFIG.FORAGER_COUNT; i++) {
    const forager = new ForagerAnt(
      `forager-${i}`,
      { x: 0, y: 0 },
      environment,
      pheromoneSystem
    );
    foragers.push(forager);
    queen.registerAnt(forager.getId(), 'forager');
  }

  log('\n--- 模拟开始 ---\n');

  // 运行可视化循环
  let tick = 0;
  const maxTicks = CONFIG.MAX_TURNS;
  const frames: string[] = [];

  // 可视化循环
  const runSimulation = async () => {
    while (tick < maxTicks) {
      tick++;
      
      // 更新所有 Agent
      scouts.forEach(scout => scout.tick());
      foragers.forEach(forager => forager.tick());
      
      // 蚁后处理消息
      // (queen 的消息处理在 handleMessage 中自动完成)
      
      // 信息素衰减
      if (tick % 5 === 0) {
        pheromoneSystem.decay();
      }

      // 获取所有 Agent 位置
      const agentPositions = [
        { id: queen.getId(), role: queen.getRole(), position: queen.getPosition() },
        ...scouts.map(s => ({ id: s.getId(), role: s.getRole(), position: s.getPosition() })),
        ...foragers.map(f => ({ id: f.getId(), role: f.getRole(), position: f.getPosition() })),
      ];

      // 渲染帧
      const frame = visualizer.render(
        environment,
        pheromoneSystem,
        agentPositions,
        tick,
        queen.getStatus().foodStorage
      );
      
      frames.push(frame);
      
      // 清屏并显示
      console.clear();
      console.log(frame);

      // 保存状态
      if (tick % 10 === 0) {
        saveColonyState(queen.getStatus());
      }

      // 延迟
      await new Promise(r => setTimeout(r, 300));
    }
  };

  await runSimulation();

  // 最终状态
  log('\n--- 模拟结束 ---');
  const finalStatus = queen.getStatus();
  log(`最终食物储备: ${finalStatus.foodStorage}`);
  log(`已知食物源: ${finalStatus.discoveredFood.length} 个`);
  log(`剩余信息素标记: ${pheromoneSystem.getAll().length} 个`);

  // 保存输出
  const outputDir = CONFIG.OUTPUT_DIR;
  writeFileSync(join(outputDir, 'final-frame.txt'), frames[frames.length - 1]);
  writeFileSync(join(outputDir, 'animation.txt'), frames.join('\n\n=== Frame ===\n\n'));
  
  saveColonyState(finalStatus);
  log('输出已保存到 output/ 目录');
  log('- final-frame.txt: 最终画面');
  log('- animation.txt: 完整动画');
  log('- colony-state.json: 最终状态');
}

main().catch(err => {
  console.error('模拟出错:', err);
  process.exit(1);
});
