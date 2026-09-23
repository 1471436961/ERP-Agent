# Project-1-1 本地 Agent 与共享源码

[INSTRUCTIONS.md](INSTRUCTIONS.md) 描述完整项目路线。Step-1 本机安装和 Step-2 本地只读 ERP Agent 已验收，证据见 [Step-1](docs/LOCAL-SETUP.md) 与 [Step-2](docs/STEP2-LOCAL-ACCEPTANCE.md) 记录。远程 ERP 接入和四平台部署尚未验收。

- `backend/`：FastAPI 宿主后端与 ERP MCP 连接器源码，含锁文件。Dockerfile 尚未完成部署验收。
- `backend/erp/local-smoke.mjs`：本地 MCP 只读订单和越权查询检查。
- `skills/erp-order-review/`：只读销售订单核查 Skill，区分 ERP 事实、业务推断与信息缺失。
- `tools/check-erp.mjs`、`check-local-reader-permissions.sh`、`check-openworker-local.py`：分别核对 API 读取、ERP 角色权限、OpenWorker MCP 与 Skill 状态。
- `tools/configure.mjs`、`tools/mcp-entry.mjs`：本地与远程环境共用的私有状态配置工具。
- `tools/bootstrap-local-reader.py`、`create-local-test-invoice.py`：一次性本地测试身份与数据准备脚本；仅用于隔离实例。
- `tools/start-openworker-local.sh`、`accept-openworker-chat.py`、`fingerprint-local-order.py`：本地启动、真实对话及单据不变验收工具。
- `config.example.json`：不含密钥的配置模板；实际值只写入 Git 忽略的 `config.private.*.json`。

本源码包不含完整 Next.js 前端或 Supabase 迁移，不能直接作为四平台应用部署。受控 PDF 含远程示例凭据，不在 Git 中分发。模型密钥、ERP API 密钥、网页密码、运行数据库、原始对话日志和用户截图均不得提交。后端原始代码来源见 `backend/erp/legacy/ORIGIN.md`；保留上游许可证与来源记录。

共享预检可用 Node 24 运行 `node --test tools/check-erp.test.mjs`；后端依赖由 `npm --prefix backend/erp ci` 安装。当前 `backend/erp` 包的 `npm test` 未包含实际测试用例；需在后续实现与部署验收中补齐。
