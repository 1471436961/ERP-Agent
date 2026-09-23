# 一期代码来源

源仓库：`/Users/mgao/Documents/lecture-9-agentify`，2026-09-18 读取。原文件未修改。

以下模块以原仓库 TypeScript 编译器转为 JavaScript ES module，仅将相对导入扩展名改为 .mjs，保持原实现。服务端与安全流程升级代码在上级目录，不把旧审批实现当新流程使用。

- connector/src/types.ts：SHA256 e21c197dd8c0d0f4a7ebe9a0660d7a1642c68b58f6429516b85edac399ccf442
- connector/src/identity.ts：SHA256 93444129c301466e5ff91fdfb4b7ef25351692e69955ba1cf273f35faf88089c
- connector/src/risk.ts：SHA256 6b27a5c9a1f8f1527dfa5cfc9f8f338b7c44c45b944f5e92a3ed923feefcb60d
- connector/src/fakeErpClient.ts：SHA256 3163505aa183a48f2c8ad8f09cd2878ff1f2384c0bf5a2fb4bacb269d2721c70

另外沿用了原 tools.ts 的五个工具名和 erpClient.ts 的 REST 路径设计；新接口收窄写入结构并补充 operation 工具。Langfuse 初始化复用课程 demos/langfuse/telemetry.mjs 的同版本 SDK 方案。
