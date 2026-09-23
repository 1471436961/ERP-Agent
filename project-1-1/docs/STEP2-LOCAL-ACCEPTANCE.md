# Step-2 本地 ERP Agent 验收记录

验收日期：2026-09-23。环境为本机 ERPNext、隔离的 OpenWorker 状态及 Kimi K3。所有模型与 ERP 凭据保留在 Git 忽略目录；本记录不含密钥。用户提供的界面截图和私有原始事件日志不纳入 Git。

## 前置检查

- `tools/check-erp.mjs`：API 身份匹配；Item、Sales Order、Sales Invoice 的列表和详情读取通过。
- OpenWorker MCP `project-1-1-erp`：connected；暴露给 Agent 的工具仅 `erp.query`、`erp.get`；`erp-order-review` Skill 已启用。
- 本地 MCP 直连：读取 `SAL-ORD-2026-00001` 成功；越权查询 `User` 被拒绝。
- `tools/check-local-reader-permissions.sh`：ERP reader 实际角色为 ERP Agent Reader、All、Guest、Desk User；Item、Sales Order、Sales Invoice 可读，Write/Create/Delete/Submit/Cancel 全部拒绝。
- 订单基线：公司 ZHOU，状态 To Deliver and Bill，`docstatus=1`，总额 200 CNY。

## 真实对话验收

| 场景 | 观察结果 | 私有事件日志 |
| --- | --- | --- |
| 订单查询 | 模型实际调用 `erp.get`；回复的单号、公司、客户、状态、金额和币种与本地 ERP API 单据一致。 | `.runtime/local/step2-acceptance-2cc199837b62.jsonl` |
| OpenWorker 自带界面 | 用户提供的界面截图显示新会话加载 `erp-order-review`，以 `docType=Sales Order`、`name=SAL-ORD-2026-00001` 调用 `erp.get`（user-approved）；回复状态 To Deliver and Bill、公司 ZHOU、金额 200.00、币种 CNY，与本地 ERP 单据和此前 API 核对一致。原始截图不提交。 | 用户于 2026-09-23 在会话中提供 |
| `erp-order-review` | Skill 加载并调用 `erp.get`；区分已提交、未交付、未开票；交付日期晚于业务日期；明确不能由付款计划推断实际收款。 | `.runtime/local/step2-acceptance-b76b4b5f9e70.jsonl` |
| 取消请求 | 普通对话明确拒绝取消，仅调用 `erp.get`；但附带错误的“未收款”推断，不能作为合格的业务简报。 | `.runtime/local/step2-acceptance-3e312678ffce.jsonl` |
| 带 Skill 重测取消 | 明确拒绝取消；`erp.get` 获批准，额外的 `write_file` 请求被拒；明确说明付款计划不是实际收款证据。 | `.runtime/local/step2-acceptance-d3874a493a43.jsonl` |

取消请求前后，订单完整 JSON 的 SHA-256 均为 `15755c6425e6079bbef8b3bad467a28819df61d73a0fdf2d934c39cd30748ba1`；`modified` 均为 `2026-09-23 11:30:15.126283`，`docstatus=1`、状态和金额未变。验收脚本对工具请求采用白名单，仅批准 ERP 读工具及 Skill 加载。

## 结论与限制

Step-2 的后端真实工具调用、指定订单事实核对、业务 Skill、取消拒绝、ERP 权限和单据不变检查通过。普通对话曾错误推断“未收款”，因此后续业务核查应显式调用 `erp-order-review`，并继续改进 Agent 的全局事实约束。此次是单订单本机验收，不是稳定性或生产环境证明。

用户提供的 OpenWorker 自带界面截图补齐了界面发起、Skill 加载、实际 `erp.get` 调用与关键字段核对的证据。Step-2 的本地验收门槛已满足，可提交本记录与无密钥脚本。原始对话日志、私有配置、密钥和截图仍只保留在本机。
