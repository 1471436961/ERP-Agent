# 2026-09-18 本地验证

- 新实例：22/22 测试通过（18 个核心/观测用例、3 个 mock HTTP 契约用例、1 个真实 MCP stdio + 独立审批 CLI 进程用例）。
- 课程原有测试：14/14 通过。
- 原零售 Langfuse 示例：5/5 通过。
- npm install --ignore-scripts：固定版本依赖和 package-lock 已生成，安装时 audit 报告 0 vulnerabilities。这不等于代码无安全问题。
- npm run demo：批准案例写入一次；拒绝案例零写入；写后超时案例落库一次、状态 unknown，重复恢复不增加写入。真实 SDK 内存 exporter 产出了连接器/执行/API 层级 Span。
- 原一期工作区的既有修改保持不变，没有覆盖 server.ts，没有迁移或重置 ERP 数据。

未运行：真实 ERP HTTP 请求、ERP 单据写入、OpenWorker 桌面/模型对话、Langfuse 云端发送。未修改已发布 Course Studio slides 或发布新代码到外部仓库。

关键边界：本地审批 CLI 信任操作系统操作员；并非隔离审批服务。连接器级去重不能替代 ERP 内唯一约束/事务；提交前校验与提交之间仍有并发窗口。详见 README.md。
