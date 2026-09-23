# ERP Agent

Step-1 的本机安装和 Step-2 的本地只读 ERP Agent 已验收。远程 ERP 接入与四平台部署仍属后续步骤，不能由本地验收推断已完成。

- [Step-1 安装与验收记录](project-1-1/docs/LOCAL-SETUP.md)
- [Step-2 本地 Agent 验收记录](project-1-1/docs/STEP2-LOCAL-ACCEPTANCE.md)
- [ERPNext Compose 回环地址补丁](project-1-1/step1/pwd.loopback.patch)
- [OpenWorker Step-1 启动脚本](project-1-1/tools/start-openworker.sh)
- [本地管理员初始密码轮换脚本](project-1-1/tools/rotate-local-admin.py)
- [项目实施说明](project-1-1/INSTRUCTIONS.md)
- [源码与工具说明](project-1-1/README.md)

上游源码、运行状态、数据库卷、API 密钥、管理员密码、原始对话日志和用户截图均不纳入 Git。Step-2 的普通对话曾出现付款状态误判；业务核查应显式使用 `erp-order-review`，详见验收记录。
