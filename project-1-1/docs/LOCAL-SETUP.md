# Step-1 本机安装与验收记录

验收日期：2026-09-23。Step-1 范围仅为本机 ERPNext 与 OpenWorker 的安装、可登录性、普通模型对话和版本记录；ERP 工具接入属于 Step-2。

## 结果

| 检查 | 结果与证据 |
| --- | --- |
| ERPNext | `http://localhost:8080` 可访问；`create-site` 退出码 0，MariaDB 健康；已登录并打开本地测试订单 `SAL-ORD-2026-00001`。 |
| 测试资料 | 公司 `ZHOU`，币种 CNY；客户 `Agent Test Customer`、物料 `AGENT-TEST-001`、销售订单 `SAL-ORD-2026-00001`。 |
| 默认管理员密码 | 官方一次性密码 `Administrator / admin` 已于验收时轮换；旧密码登录被拒绝，新密码登录通过。新密码仅存于 Git 忽略的 `.runtime/step1/admin-credentials.json`，不提交。旧登录会话可能需要重新登录。 |
| OpenWorker | `http://localhost:1420` 与本机后端 `127.0.0.1:8765` 可访问。用户已确认 Kimi K3 返回过一条真实普通聊天回复。Step-1 状态保留在 WSL 的 `/home/erpdev/erp-agent/state/step1`；当前运行服务已切换至后续 Step-2 隔离状态。 |
| 截图 | 本机私有的 `.runtime/step1/screenshots/erp-sales-order.png` 显示实际订单号；`openworker-ui.png` 显示 OpenWorker 页面（在切换至 Step-2 状态后拍摄）。两张图均不提交。普通模型回复由用户确认，未保存回复原文或模型密钥截图。 |

## 固定版本和架构

- Windows + WSL Ubuntu 24.04，Linux 架构 `x86_64`；Python 3.12.3、Node.js 24.15.0、npm 11.12.1。
- Docker Engine 29.5.3，Compose 5.1.4；Docker Desktop 的数据磁盘和 Ubuntu 发行版均已迁至本工作区的 Git 忽略 `.runtime/`。
- ERPNext 源码：`frappe/erpnext` 标签 v15.72.1，提交 `396886c6e87d65053c37b0637ed085df3fd660f0`。
- Compose 源码：`frappe/frappe_docker` 提交 `a7295c6c96d607c7fa52f1ef8d10095fdd80801e`；本仓库 `step1/pwd.loopback.patch` 将前端端口限定为 `127.0.0.1:8080:8080`。
- 运行镜像：`frappe/erpnext:v15.72.1` (`sha256:ab66494f6af65efa830fc6e47677f5d4c052f8209df0ceea4629f7d2c88a55dd`, amd64)；`mariadb:10.6` (`sha256:40153feb479c0da88b5cfe3f50f44c91f7baf05a1b7bcc5beb7eb37a890a8f16`, amd64)。
- OpenWorker：`mrvgao/openworker` 分支 `codex/project-main`，提交 `295dc1622abc7cc111347611233e43545a1e20aa`；本机位于 `/home/erpdev/erp-agent/openworker`。

## 复现与日常操作

在本机先安装 Docker Desktop 并启用 Ubuntu 24.04 的 WSL 集成。上游源码与运行数据放在 Git 忽略目录，使用固定版本：

```bash
git clone --branch v15.72.1 https://github.com/frappe/erpnext.git
git clone https://github.com/frappe/frappe_docker.git
cd frappe_docker
git checkout a7295c6c96d607c7fa52f1ef8d10095fdd80801e
git apply --unidiff-zero ../project-1-1/step1/pwd.loopback.patch
docker compose -p project11-erp -f pwd.yml up -d
```

等待 `create-site` 退出码为 0，再在 `http://localhost:8080` 完成初始化并建立本机测试资料。官方初始 Administrator 密码只适合首次建站，随后用 `tools/rotate-local-admin.py` 在容器的 bench console 中轮换；将其生成的 `/tmp/project11-admin-credentials.json` 移到本机 Git 忽略目录，确认新密码可登录后删除容器临时文件。脚本仅供仍使用官方初始密码的新实例执行一次。

OpenWorker 固定到上列 `codex/project-main` 提交并按其 `packaging/setup_dev_env.sh` 安装；本机 Step-1 启动脚本为 `tools/start-openworker.sh`，在 Ubuntu 24.04 中以 root 执行。模型密钥只在本机界面输入并测试普通对话。脚本中的 `/home/erpdev/erp-agent` 是本机安装路径，其他机器需调整。

日常停止 ERP 使用 `docker compose -p project11-erp -f pwd.yml stop`，不要使用 `down -v` 删除测试数据卷。Docker Desktop 在本机曾因 Windows AF_UNIX 套接字残留无法启动；通过停止 Docker 后保留并重命名受影响的运行目录恢复，未做恢复出厂设置。该问题可能复发。Step-1 验收不代表 Step-2 的 ERP Agent 聊天查询已完成。
