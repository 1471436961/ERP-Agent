# ERPNext + OpenWorker：受控执行与 Langfuse 观测

这是一期连接器的教学升级版。保留一期 ERPNext 部署、API 路径、工具命名、Identity/risk/FakeErpClient 实现；替换内存审批与去重机制。原工程 `/Users/mgao/Documents/lecture-9-agentify` 不改动。

## 快速演练

Node >=24。进入本目录运行：

```sh
npm ci --ignore-scripts
npm test
npm run demo
```

`demo` 使用 Fake ERP 和**脚本模拟的审批决定**，不调用模型、不访问真实 ERP、不发送云端 Trace。展示：批准后创建、拒绝零写入、写入后超时保持 unknown、重复 resume 不重复写入。它不是 OpenWorker 的真人对话验收。

依赖均固定版本，锁文件随代码提供。SQLite 使用 Node 内置模块。测试临时数据库只含虚构数据，位于系统临时目录。

## 代码阅读顺序与一期对比

| 原实现 | 本次升级 | 入口 |
|---|---|---|
| 固定服务账号、未验证登录结果 | 每进程绑定受限 ERP 用户；启动时核验 API token 的真实用户，拒绝 Administrator/Guest | erp-http.mjs、server.mjs |
| DocType allowlist | 复用 Identity，增加动作和报表白名单，工具参数拒绝 user/approved 等额外字段 | policy.mjs |
| AUTO_APPROVE / stderr inbox | 持久化 pending，人工终端 approve/reject，模型只能 status/resume | store.mjs、approval-cli.mjs |
| Set 内存去重，submit 未含 name | SQLite 唯一业务键、提交包含单据名、原子 claim、重启仍不重复执行 | store.mjs、policy.mjs |
| 提交预览失败降级为 ID | 读取失败直接停止；执行前重新检查单据快照、金额、交易方、币种 | engine.mjs |
| 回执后读取 docstatus | 读取状态、交易方、明细及金额；失败记 unknown，不重新写入 | engine.mjs |
| stderr 日志 | Langfuse SDK 嵌套观测；业务状态仍保存在 SQLite / ERP | telemetry.mjs |

原五个业务工具保留；新增第六个 `erp.operation` 仅查询／恢复操作。创建草稿工具刻意收窄为采购发票、结构化行项目，不接受任意 DocType 或自由 JSON。Supplier/Company 可加入只读名单；是否可读仍由 ERPNext 权限决定。报表默认不开放。

## 真实 ERP 与 OpenWorker 接入

1. 沿用一期隔离账套，不运行 seed/reset/nuke。确认公司、供应商、商品、币种和财年使用现有有效值。
2. 在操作员控制的私有目录保存 `profile.example.json` 的副本和 `.env.example` 对应配置。将 company/currency/erpUser 改成沙箱真实值，不要照搬示例 USD。
3. 为该 ERP 用户配置 API key/secret。新入口不使用旧沙箱密码。每个身份启动独立 MCP 进程；同一 ERP 部署必须使用同一状态数据库，避免绕过去重。
4. `ERP_STATE_DB` 的父目录须是操作员创建的私有目录（权限 0700）；数据库自动设为 0600。不要放进模型可读写的工作区。
5. OpenWorker 使用 stdio 配置，保留自身操作确认，不启用自动审批。以下路径均需替换；没有自动修改用户现有 OpenWorker 配置。

```json
{
  "mcpServers": {
    "erpnext-governed": {
      "command": "/absolute/path/to/node",
      "args": ["--env-file=/absolute/operator-private/erp.env", "/absolute/path/to/erp-governed/server.mjs"],
      "requires_approval": true
    }
  }
}
```

这里仍沿用一期验证过的 stdio 方式，不需要公开 MCP URL。Node 直接启动，stdout 只写协议。MCP transport 已用真实 SDK 客户端验证，**未启动 OpenWorker 桌面 UI 或真实模型对话**。

## 课堂现场：两次审批，而不是一次总授权

先用只读 profile（actions 只留 erp.query / erp.get）演示查询与写入拒绝；再启动受限采购身份的进程。

1. 对话要求为 Globex 起草采购发票，提供真实公司／商品编号、发票号和金额。工具返回 `pending` + operationId，ERP 没有新单据。
2. 讲师在模型之外的操作员终端查看：

```sh
node --env-file=/absolute/operator-private/erp.env approval-cli.mjs list
node --env-file=/absolute/operator-private/erp.env approval-cli.mjs show OPERATION_ID
node --env-file=/absolute/operator-private/erp.env approval-cli.mjs approve OPERATION_ID PAYLOAD_HASH
# 或 reject OPERATION_ID PAYLOAD_HASH
```

3. 阅读 preview 的公司、供应商、金额、明细及动作，再手动批准。hash 必须来自 show，不是模型说“我批准了”。审批默认 5 分钟有效。
4. 告诉 Agent 恢复该 operationId，调用 `erp.operation`，参数 `mode: "resume"`。回查成功才返回 verified。
5. 请求提交刚创建的草稿。这会产生**另一条 pending 操作**，需再次批准。OpenWorker 自己的确认、连接器批准、ERP 的角色权限与业务 Workflow 是不同层，不能互相替代。
6. 拒绝另一张发票：resume 应保持 rejected，ERP 无新增。

简化状态机：pending → approved → executing → verified / unknown / blocked。pending 也可变为 rejected / expired。
expired、rejected、blocked 不自动重开；unknown 或崩溃遗留的 executing 必须人工对账。此版本故意不提供强制重试／清除幂等键工具。

## Langfuse：能看到什么

默认使用真实 Langfuse SDK 的内存 exporter。配置项目对应区域的 `LANGFUSE_BASE_URL`、public/secret key，并显式设置 `SEND_LANGFUSE=1`，才发送云端。离线 demo 则需显式 `npm run demo -- --send-langfuse`。API 密钥不写入代码或 slides。

一次恢复执行的 Trace：erp.connector.call / erp.operation.execute / erp.api.list、insert、get。人工审批 CLI 产生独立 decision Trace，以随机生成的 operationId 关联。

请求、人工审批、恢复执行可能在不同进程／不同时间，**不是自动拼成一条跨进程父子 Trace**。在 Langfuse 以 metadata.operationId 对照事件，再看 SQLite 的真实状态。模型调用、token 数、费用、OpenWorker 内部规划目前不在本实例的观测范围内。

只发送动作名、状态、随机 operationId、Span 时间和层级；不发送原始业务单据、供应商、邮件、模型文本、凭证或 ERP 异常原文。拒绝／未知状态不会伪装成业务成功。关闭进程时 flush/shutdown。

## 必须讲清楚的安全边界

- 这是单机教学审批流程，不是生产审批系统。CLI 以操作系统操作员身份记账，没有独立的人类身份认证服务。
- **如果 OpenWorker 具有同一账号的任意 shell／文件权限，它仍可读取配置、调用 CLI 或修改数据库。**不得把 prompt 中“不要批准”当成权限隔离。授课要禁用不必要的 shell/文件工具；生产需将审批与密钥放在隔离服务，使用认证与角色授权，Agent 只拿业务调用能力。
- API token 绑定是每进程身份绑定，不是多人共享聊天中的 SSO/OAuth 委托。ERPNext 自己仍负责角色权限，连接器没有替它授予权限。
- SQLite 去重只保护使用同一状态库的连接器；无法保证外部系统、另一套数据库或其他 ERP 客户端的 exactly-once。
- 提交前读取与提交之间仍有并发窗口。生产需要 ERP 服务端事务、文档版本比较与业务唯一约束。写后校验能够发现问题，但不能撤销已发生的提交。
- 草稿审批显示行项目估算，ERP 税费／规则可能改变最终金额；超限会停在 unknown，不自动提交。不要把估算称为 ERP 最终结算金额。
- `verified` 表示代码中列出的字段检查通过，不代表所有会计约束或评测用例都通过。
- Langfuse 不是状态数据库，也不是审批执行器；文本边界标记不能独自防住提示注入。

## 验证范围

本次验证：离线核心用例、真实 MCP stdio 传输、mock fetch 的 REST 契约、真实 Langfuse SDK 内存导出及敏感字段排除。
尚未验证：真实 ERP 写入／提交、ERP 多角色配置、OpenWorker 端到端模型对话、Langfuse 云端接收。本次未修改 ERP 数据，也未上传任何 Trace。

参考：[Frappe REST API](https://docs.frappe.io/framework/user/en/api/rest)、[Langfuse instrumentation](https://langfuse.com/docs/observability/sdk/instrumentation)。
