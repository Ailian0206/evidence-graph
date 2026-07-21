# Evidence Graph

Evidence Graph 是一个可追溯的 AI 研究工作台，也是 Ailian 的个人作品集。它把研究问题转换为持久化的来源、主张、证据关系、冲突和带引文报告，读者可以逐层检查到原始证据片段。

项目可在本地运行。日常测试只使用确定性 Provider fixtures，不调用付费 API。

## 项目文档

- `docs/product-plan.md`：产品、架构、部署、成本和交付决策。
- `docs/development-plan.md`：模块与 PR 顺序。
- `docs/deployment.md`：托管部署、生产冒烟、回滚、备份和密钥轮换。
- `PROJECT_STATUS.md`：当前执行状态。
- `AGENT.md`：工程、GitHub、成本和验证流程。

## 本地命令

```bash
npm install
npm run dev
npm run test:ci
```

运行门禁前使用 Node.js 22：

```bash
nvm use
```

Playwright 默认使用 `3217` 端口，避免与同级项目冲突；需要时可以覆盖：

```bash
PLAYWRIGHT_PORT=3220 npm run test:e2e
```
