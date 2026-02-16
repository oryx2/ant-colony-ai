# Ant Colony AI Simulation

使用 Vercel AI SDK + Kimi K2.5 模拟蚁穴运作的分布式多 Agent 系统。

## 架构

- **蚁后 (Queen)**: 中央调度，资源分配
- **侦察蚁 (Scout)**: 探索环境，发现食物源
- **采集蚁 (Forager)**: 搬运食物，维护巢穴储备

## 通讯机制

- **信息素系统**: 持久化 JSON 文件模拟环境标记
- **消息总线**: EventEmitter 实现 Agent 间通讯

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 MOONSHOT_API_KEY

# 运行模拟
npm run dev
```

## 输出

运行日志和状态会输出到 `output/` 目录：
- `simulation.log`: 详细运行日志
- `pheromones.json`: 信息素状态
- `colony-state.json`: 蚁穴整体状态
