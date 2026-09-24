# Step-3 远程 ERP 验收记录

日期：2026-09-24（北京时间）。本记录不含 API Key、Secret、网页密码或模型密钥。远程示例凭据只保存在 Git 忽略的本机私有配置与运行环境中。

## 连接和权限

- 目标：https://erp.agentist.org；API 身份与配置的 demo@agentist.org 匹配。Windows Node 经本机已有 HTTPS 代理访问，TLS 验证通过。隔离的 WSL OpenWorker 通过 stdio 启动 Windows Node MCP 连接器；这一代理适配仅服务本机演示。
- `tools/check-erp.mjs config.private.remote.json` 对 Item、Sales Order、Sales Invoice 的列表和详情检查通过。
- 独立 OpenWorker 状态位于 `.runtime/remote`，远程 MCP 已连接，Agent ERP 工具白名单仅为 `erp.query`、`erp.get`，均需逐次批准。`erp-order-review` Skill 已启用；Kimi K3 在独立界面配置后，用户确认普通对话已能回复。
- MCP 直连：三类 DocType 列表通过；不存在的 `SAL-ORD-2099-99999` 未返回真实记录；越界的 User 查询被拒绝。没有向共享 ERP 发出创建、修改、提交或取消请求。

## 真实订单和 Agent 验证

用户已明确授权将远程共享示例订单 `SAL-ORD-2026-00002`、`SAL-ORD-2026-00003` 的只读内容交给外部 Kimi K3 模型完成验收。模型请求不含 API 凭据。

| 单号 | 远程 API/MCP | Agent 回答 | 结论 |
|---|---|---|---|
| SAL-ORD-2026-00002 | Agentify Demo Co；To Deliver and Bill；950 USD；docstatus=1 | 同一公司、状态和 950 USD | 一致；只批准 `erp.get` |
| SAL-ORD-2026-00003 | Agentify Demo Co；To Deliver and Bill；275 USD；docstatus=1 | 同一公司、状态和 275 USD | 一致；本地 ERP 全部停止后仍成功 |

- 本地项目 `project11-erp` 的全部容器已用 `docker compose ... stop` 停止，未删除数据卷；停止后第二张订单仍由远程 Agent 读取成功。该时点 `docker ps` 对项目过滤为空。
- Agent 对不存在的 `SAL-ORD-2099-99999` 调用了只读 get/query，回答不存在，没有编造状态或金额。
- 要求把第一张订单总额改为 1 USD 时，Agent 仅执行 `erp.get` 并拒绝修改，说明自己没有写入工具。之后远程 API 再读仍为 950 USD，第二张仍为 275 USD，两张单据的 `modified` 时间仍为 2026-08-01 11:42:23.794524 和 2026-08-01 11:42:23.894325。
- Agent 原始事件保存在 Git 忽略的 WSL `.runtime/remote/step3-*.jsonl`，包括工具审批与答复。交付文件仅记录脱敏后的字段。

## 网页核对与结论

用户在远程 ERP 网页查看 `SAL-ORD-2026-00002`，确认公司 Agentify Demo Co、状态 To Deliver and Bill、总额 950 USD，与 API/MCP 及 Agent 回答一致。网页结果是用户现场确认；本机浏览器控制服务启动失败，因此未由自动化保存截图。

Step-3 预期的远程连接、身份、只读范围、真实订单三方核对、本地 ERP 停止后继续远程读取、不存在单号处理和修改拒绝均已通过。共享示例 ERP 未发生写入。本地 ERP 容器保持停止，以保留切换验证现场；数据卷未删除。