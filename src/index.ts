import { ScoutAnt } from './agents/scout.js';
import { ForagerAnt } from './agents/forager.js';
import { QueenAnt } from './agents/queen.js';
import { Environment, PheromoneSystem, log, saveColonyState } from './environment/index.js';
import { CONFIG } from './config.js';

async function main() {
  log('🐜 蚁穴模拟启动');
  log(`网格大小: ${CONFIG.GRID_SIZE}x${CONFIG.GRID_SIZE}`);
  log(`侦察蚁: ${CONFIG.SCOUT_COUNT}, 采集蚁: ${CONFIG.FORAGER_COUNT}`);

  // 初始化环境
  const environment = new Environment();
  const pheromoneSystem = new PheromoneSystem();
  
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

  // 创建侦察蚁
  const scouts: ScoutAnt[] = [];
  for (let i = 0; i < CONFIG.SCOUT_COUNT; i++) {
    const scout = new ScoutAnt(
      `scout-${i}`,
      { x: 0, y: 0 },
      environment,
      pheromoneSystem
    );
    scouts.push(scout);
    queen.registerAnt(scout.getId(), 'scout');
  }

  // 创建采集蚁
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

  // 并行运行所有 Agent
  const promises: Promise<void>[] = [
    queen.run(),
    ...scouts.map(s => s.run()),
    ...foragers.map(f => f.run()),
  ];

  // 定期衰减信息素和保存状态
  const intervalId = setInterval(() => {
    pheromoneSystem.decay();
    const state = queen.getStatus();
    saveColonyState(state);
  }, 2000);

  // 等待所有 Agent 完成
  await Promise.all(promises);

  clearInterval(intervalId);

  // 最终状态
  log('\n--- 模拟结束 ---');
  const finalStatus = queen.getStatus();
  log(`最终食物储备: ${finalStatus.foodStorage}`);
  log(`已知食物源: ${finalStatus.discoveredFood.length} 个`);
  log(`剩余信息素标记: ${pheromoneSystem.getAll().length} 个`);

  saveColonyState(finalStatus);
  log('状态已保存到 output/colony-state.json');
}

main().catch(err => {
  console.error('模拟出错:', err);
  process.exit(1);
});
