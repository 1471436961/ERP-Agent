# Project-1-1 共享源码基线

[INSTRUCTIONS.md](INSTRUCTIONS.md) 描述完整项目路线。当前仓库已完成 Step-1；本目录中的通用工具与后端源码只是后续步骤的基线，不代表本地 Agent 或远程部署已经验收。

- `backend/`：FastAPI 宿主后端与 ERP MCP 连接器源码快照，含锁文件。Dockerfile 尚未完成部署验收。
- `tools/check-erp.mjs`：只读 ERP API 身份、列表和详情预检；`check-erp.test.mjs` 为离线测试。
- `tools/configure.mjs`、`tools/mcp-entry.mjs`：本地与远程环境共用的私有状态配置工具。
- `config.example.json`：不含密钥的配置模板。实际值仅写入 Git 忽略的 `config.private.*.json`。

本机 Step-2 专用的用户创建、测试数据、聊天验收、启动和状态检查脚本，以及 `erp-order-review` Skill 暂不提交。此源码包不含完整 Next.js 前端或 Supabase 迁移；不能将目录直接当作完整四平台应用部署。

受控 PDF 含远程示例凭据，不在 Git 中分发。不要将模型密钥、ERP API 密钥、网页密码、运行数据库或用户截图放入提交。后端原始代码的来源见 `backend/erp/legacy/ORIGIN.md`。保留所用上游项目的许可证与来源记录。

共享预检可用 Node 24 运行 `node --test tools/check-erp.test.mjs`；后端依赖由 `npm --prefix backend/erp ci` 安装。当前 `backend/erp` 包的 `npm test` 未包含实际测试用例；需要在后续实现与部署验收中补齐。
