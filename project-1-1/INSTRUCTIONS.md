# Project-1-1

## ERPNext Agent：本地集成、远程验证与云端交付

| 文档属性 | 内容 |
|---|---|
| 版本 | 1.3 / OpenWorker Project Main 修订 |
| 项目角色 | 开发工程师、平台运维、业务验收人 |
| 技术栈 | ERPNext / OpenWorker / MCP / Vercel / Supabase / Render / Cloudflare |
| 目标 | 将已有 ERP 接入 Agent，通过四个平台交付可登录、可查询、可追溯的远程应用 |
| 交付边界 | 只读查询；不包含共享 ERP 的新增、删除、审批或取消操作 |
| 实施原则 | 每一步独立验收。前置检查未通过，不进入下一步、不反复重新部署 |

本项目模拟一次企业现有系统 Agent 化交付：企业已有 ERPNext，开发团队负责连接器、业务 Skill、用户入口和部署。OpenWorker 是 Agent 运行时，不是另一个需要由 Agent 操纵鼠标的目标程序。

本文中的 Supabase 指身份与数据库平台，不是“Suppose”。ERPNext 保留其原生数据库；不要把 ERPNext 的 MariaDB 迁到 Supabase。

### 路线与完成结果

| 阶段 | 要完成的工作 | 离开此阶段前的证据 |
|---|---|---|
| Step-1 | 本机安装 ERPNext 与 OpenWorker | ERP 可登录；OpenWorker 可对话；版本与端口已记录 |
| Step-2 | 构建基于 OpenWorker 的本地 ERP Agent | 工具实际查询本地 ERP；答案与单据一致；越权写入被拒绝 |
| Step-3 | 同一套 Agent 接入远程 ERP | 远程凭证身份匹配；列表与详情读取成功；没有误连本地 |
| Step-4 | 部署自己的四平台应用 | 关闭本机服务后，远程登录、查询、历史与数据隔离仍然有效 |

### 重要：当前已核验与尚未完成的事项

2026-09-18 21:22 PDT 完成初次检查；21:35 PDT（2026-09-19 04:35 UTC）完成示例 API 凭证生成与复验：

| 检查项 | 实际结果 | 对实施的影响 |
|---|---|---|
| `https://erp.agentist.org/login` | HTTP 200 | 网页入口可访问 |
| `demo@agentist.org` 的网页登录 | HTTP 200，Logged In | 网页账号和密码见配套受控 PDF 的 Step-3 |
| 示例会话读取 Item / Sales Order / Sales Invoice | 各 HTTP 200，均返回记录 | 示例账号具备这三类单据的读取权限 |
| 匿名读取销售订单 | HTTP 403 | 必须认证 |
| 示例账号有效权限 | 可读；不可创建、修改、删除、提交、取消 | 适用于本项目只读范围 |
| 示例账号 API key / secret | 已生成并验证身份、三类单据列表与详情读取 | 直接使用 Step-3 受控 PDF 中的完整配置；网页密码仍不能代替 API secret |
| 既有运营身份的 API 认证与三类读取 | 通过 | 证明远程 API 工作正常；该身份的密钥不随项目分发 |

G0 已补齐：共享只读示例 API 身份为 demo@agentist.org，受控 PDF 的 Step-3 提供可直接复制的连接配置。本版本包含有效示例凭证，只在项目范围内分发，不发布到公开仓库或网页。各部署仍须运行自检；凭证可能被停用或轮换，届时更新配置即可，无需重装系统。既有运营 Agent 的账号和密钥未修改。

本次核验覆盖现有环境与远程权限；没有在全新电脑重新安装 ERPNext，也没有替每个新账户完成四平台付费部署。下文明确区分“上游安装步骤”“已提供后端”“需要实现的前端”。最终只有逐项通过验收，才能宣布交付。

<!-- PAGEBREAK -->

## 0. 工程准备与交付包

### 0.1 工具与平台

本地命令以 macOS / Linux 的 Bash 为基准；Windows 使用 WSL2 与 Docker 集成，在 WSL 内完成 Python/Node 安装，避免混用 Windows 与 Linux 的路径和虚拟环境。

- Git、Docker Engine/Desktop 与 Compose v2；能够执行 `docker info`。
- Python 3.12、Node.js 24。OpenWorker 本身最低要求较低，但本项目连接器使用 `node:sqlite`，因此统一采用 Node 24。
- 可调用工具的模型与有效 API key；模型额度不足时，ERP 正常也不能完成 Agent 对话。
- Vercel、Supabase、Render、Cloudflare 的自有项目权限；自有域名或获授权子域名。
- 本地磁盘与 Docker 资源须能容纳数据库及 ERP 多个容器；不要在已有业务 Compose 项目上试验。

```bash
git --version
docker version
docker compose version
docker info
python3 --version
node --version
npm --version
```

### 0.2 文件布局

将配套 `project-1-1-support.zip` 解压到你自己的项目目录。包内包含现有后端源码快照与配置/自检工具，不包含密码、模型 key、数据库和完整前端。

```text
ERP Agent/
  erpnext/                 ERPNext 上游源码，供阅读与追溯
  frappe_docker/           官方本机容器启动工程
  openworker/              OpenWorker 固定版本源码
  project-1-1/             配套交付包
    backend/              FastAPI + OpenWorker + Node MCP
    skills/               erp-order-review/SKILL.md
    tools/                配置生成与 ERP 自检
    config.example.json   无密钥配置模板
    INSTRUCTIONS.md       本文源文件
    web/                  需要实现的 Next.js 应用；包内不预置
```

后端基于快照 `a6b40e6017f8cecb8c4d9809daf1ae1ee8ca4cd8`，已更新 OpenWorker 依赖。使用 [mrvgao/openworker](https://github.com/mrvgao/openworker) 的 `codex/project-main` 分支；本次核对提交为 `30d6e9a0144868caf37e780d70003f03ff520a87`。配套包无需访问私有主仓库。

已有本机 `start-class.sh` 是特定电脑的启动器，依赖预存容器和绝对路径，不是新电脑安装器。本项目不使用它作为通用安装命令。

### 0.3 四种凭证不要混用

| 凭证 | 使用者 | 存放位置 |
|---|---|---|
| ERP 网页账号/密码 | 在 ERP 页面核对数据的人 | 密码管理器；不放 Git/PDF |
| ERP API key/secret | Node MCP 连接器 | 由受控 PDF 复制到本地私有配置 / Render secret；不得提交 Git |
| 模型 API key | OpenWorker 模型调用 | OpenWorker 配置 / Render secret |
| Agent gateway token | Vercel 到 Render 的服务请求 | 两端服务端环境；不发给浏览器 |

<!-- PAGEBREAK -->

## Step-1：本机安装 ERPNext 与 OpenWorker

### 1.1 获取 ERPNext 源码与官方容器工程

在 `ERP Agent` 目录执行以下命令，不覆盖已有目录：

```bash
git clone --branch v15.72.1 https://github.com/frappe/erpnext.git
git clone https://github.com/frappe/frappe_docker.git
cd frappe_docker
git checkout a7295c6c96d607c7fa52f1ef8d10095fdd80801e
docker compose -p project11-erp -f pwd.yml config --images
```

关键区别：克隆 `frappe/erpnext` 只得到源码，不会启动 ERP。运行环境由 `frappe_docker` 提供。上面的固定 Docker 示例使用 ERPNext v15.72.1 与 MariaDB 10.6，与远程 ERP 保持 v15 主版本；源码也固定到 v15.72.1，但不会自动挂载进容器。上游 main 当前已转到 v16，所以不要省略 checkout。该历史版本仅用于本地隔离复现，不作为公网生产安全基线；本地与远程补丁版本仍可能不同，必须分别执行 Step-2/3。[ERPNext 安装说明](https://github.com/frappe/erpnext)、[固定 Compose 源码](https://github.com/frappe/frappe_docker/blob/a7295c6c96d607c7fa52f1ef8d10095fdd80801e/pwd.yml)

检查 `pwd.yml` 中 frontend 的端口映射。新本地实例将 `8080:8080` 改为 `127.0.0.1:8080:8080`，避免默认示例密码的实例暴露到局域网。Apple Silicon 如遇镜像平台不匹配，遵循官方 ARM 指南处理；不要将平台错误当成 ERP 应用错误。

```bash
docker compose -p project11-erp -f pwd.yml up -d
docker compose -p project11-erp -f pwd.yml ps -a
docker compose -p project11-erp -f pwd.yml logs --tail=100 create-site
```

首次建站需要时间。以 `create-site` 成功退出、后端正常和网页登录成功为准，不是仅看到容器列表就完成。访问 `http://localhost:8080`；此固定官方一次性示例的初始身份是 `Administrator / admin`。只用于本地初始化，完成后更换密码，不将管理员身份交给 Agent。此组合不是远程示例账号。[官方快速试用说明](https://github.com/frappe/erpnext)

按初始化向导建立测试公司、币种与基本资料；准备一个测试客户、一个物料及至少一张销售订单，用于后续独立核对。数据只在自己的本地 ERP 内创建。不要以“空列表”作为业务端到端成功证据。

日常停止只执行 `docker compose -p project11-erp -f pwd.yml stop`；不要用 `down -v` 排错，它会删除该项目的数据卷。

### 1.2 安装并启动 OpenWorker

回到 `work`：

```bash
git clone --branch codex/project-main --single-branch https://github.com/mrvgao/openworker.git
cd openworker
git branch --show-current
git rev-parse HEAD
bash packaging/setup_dev_env.sh
```

新建一个空工作目录。在终端 A 中运行，替换下面的绝对路径：

```bash
.venv/bin/openworker-server --cwd /你的/workspace --port 8765
```

终端 B 从 `openworker` 目录运行：

```bash
cd surfaces/gui
npm ci
npm run dev -- --host 127.0.0.1
```

确认分支输出为 `codex/project-main`，记录实际提交；不要切回原上游旧提交。浏览器界面端口为 1420，先启动后端，再启动 GUI；后端重启后 token 无效时，重启 GUI。无需构建 Tauri 桌面壳或 Rust 工具链。配置自己的模型 key，完成普通对话。[OpenWorker 维护分支](https://github.com/mrvgao/openworker/tree/codex/project-main)

### Step-1 预期结果与注意事项

| 检查 | 通过标准 | 未通过先检查 |
|---|---|---|
| ERP 页面 | 能登录并打开实际测试单据 | 建站日志、8080 冲突、数据库健康 |
| OpenWorker 页面 | 1420 可打开，后端连接正常 | 8765、启动顺序、同一运行环境 |
| 普通模型对话 | 有真实模型回复 | key、额度、模型名称；不是 ERP 问题 |
| 版本记录 | 记录 Git SHA、镜像标签与系统架构 | 不使用“最新版”作为复现信息 |

保存截图与一张真实单号。Step-1 成功不意味着 ERP 工具已经接入。

<!-- PAGEBREAK -->

## Step-2：构建连接本地 ERP 的 OpenWorker Agent

### 2.1 理解工程边界

```text
OpenWorker（Python，模型与 Agent 循环）
    ↓ MCP / stdio，自动拉起 Node 子进程
backend/erp/server.mjs（工具入口）
    ↓ policy.mjs + engine.mjs（参数与权限）
backend/erp/erp-http.mjs（REST 客户端）
    ↓ HTTP，只允许本机使用明文 HTTP
本地 ERPNext
```

本步骤由 OpenWorker 自带界面发起任务；不另写一个 Agent 控制 OpenWorker。`backend/app.py` 是 Step-4 用来发布 HTTP 服务的封装，此时不必同时运行，避免混淆两个聊天入口。

### 2.2 建立本地只读身份

在自己的本地 ERP 使用管理员初始化：建立普通 System User（例如 `erp-reader@example.com`），建立只读角色，为 Item、Sales Order、Sales Invoice 授予 Read 与 Desk 所需访问，不授予 Write/Create/Delete/Submit/Cancel。添加 Company 的 User Permission 限定测试公司，并避免同时分配带写权限的其他角色。

在该用户的 API Access 区域生成 API key/secret。使用普通身份登录验证读取；如果没有权限，不要换成 Administrator 绕过。API secret 必须单独保存，网页登录密码不能代替它。[Frappe REST 认证](https://docs.frappe.io/framework/user/en/api/rest)

### 2.3 配置项目连接器

进入解压后的 `project-1-1` 目录；以下命令全部在该目录执行：

```bash
npm --prefix backend/erp ci
cp config.example.json config.private.local.json
chmod 600 config.private.local.json
```

用编辑器填写 `config.private.local.json`，不要把它提交 Git：

```json
{
  "ERP_URL": "http://localhost:8080",
  "ERP_USER": "erp-reader@example.com",
  "ERP_API_KEY": "<你本地生成的 API key>",
  "ERP_API_SECRET": "<你本地生成的 API secret>",
  "COMPANY": "<本地实际公司名称>",
  "CURRENCY": "<本地实际币种>"
}
```

```bash
node tools/check-erp.mjs config.private.local.json
node tools/configure.mjs local
```

自检应显示 `identity: matched`，三个单据类型均 `list_and_detail_pass`。`empty_dataset_permission_pass` 只表示接口成功但无记录，需补充本地测试数据。配置器生成 `.runtime/local/` 下的私有环境、profile 和 MCP 配置，工具列表限定为 `erp.query`、`erp.get`。重复配置会拒绝覆盖，避免损坏已有配置。

### 2.4 使用隔离的 OpenWorker 配置

先停止 Step-1 的后端与 GUI，释放 8765/1420。在两个新终端都执行下面两行，替换成自己的真实路径：

```bash
export PROJECT_ROOT="/你的/work/project-1-1"
export COWORKER_STATE_DIR="$PROJECT_ROOT/.runtime/local"
```

终端 A，进入 `work/openworker`：

```bash
.venv/bin/openworker-server \
  --cwd "$COWORKER_STATE_DIR/workspace" --port 8765
```

终端 B，进入 `work/openworker/surfaces/gui`：

```bash
npm run dev -- --host 127.0.0.1
```

隔离状态目录没有复制原来的模型 key，需重新在界面配置模型。两个终端的 `COWORKER_STATE_DIR` 必须完全相同；浏览器端口也必须与后端默认 8765 配套。连接器由 MCP 管理器自动启动，不需要手动打开第三个终端运行 `server.mjs`。

### 2.5 增加业务 Skill 并验收

将包内 `skills/erp-order-review` 目录复制到 `.runtime/local/workspace/.coworker/skills/`，保持 `erp-order-review/SKILL.md` 层级。新建会话并确认 Skill 已启用。

先发送：“查询销售订单【实际单号】，返回状态、公司、金额和币种。”再发送：“使用 erp-order-review 核查同一订单，业务日期为【实际日期】，区分事实、跟进建议和缺失信息，不执行修改。”

观察 Skill 加载与 MCP 调用，不以模型自称“已连接”作为证据。MCP 列表可能只返回单号，需要 `erp.get` 获取详情；现有列表最多 50 条，没有排序保证，不可称为全量或最新记录。

### Step-2 预期结果与注意事项

- 工具记录有真实调用；回答与 ERP 网页中同一单号一致。
- Skill 能区分已提交与已交付、开票与回款；缺字段不编造。
- “取消订单”被拒绝，ERP 记录未改变；看见 MCP 工具不等于拥有写权限。
- 本机 MCP 已接通不代表能远程访问本机 localhost；localhost 永远指当前程序所在的机器/容器。

<!-- PAGEBREAK -->

## Step-3：验证 Agent 接入远程 ERP

### 3.1 明确远程入口与权限

| 项目 | 值 |
|---|---|
| 网页入口 | [https://erp.agentist.org/login](https://erp.agentist.org/login) |
| API 基础地址 | `https://erp.agentist.org`，不带 `/login` |
| 示例网页用户 | `demo@agentist.org`；完整网页登录密码见配套受控 PDF 的 Step-3 |
| 数据范围 | 示例公司 Agentify Demo Co；实际记录使用其自身币种，不假设 CNY |
| 允许操作 | 物料、销售订单、销售发票只读 |
| 写操作 | 不允许；不得在共享实例做建单或压测 |

使用下方完整示例配置即可，不需要再等待发放 API 身份。该 key/secret 已验证属于 demo@agentist.org，只能读取示例数据；不是管理员凭证，也不是现有运营 Agent 的凭证。不要把网页登录密码填入 ERP_API_SECRET。

### 3.2 独立远程配置，保留本地环境

在 `project-1-1` 目录：

```bash
cp config.example.json config.private.remote.json
chmod 600 config.private.remote.json
```

将 config.private.remote.json 内容替换为以下 JSON。公司是 Agentify Demo Co，币种是 USD；不要改成原先设想的 EasternManufacture/CNY，也不要复制本地 key。

```json
{
  "ERP_URL": "https://erp.agentist.org",
  "ERP_USER": "demo@agentist.org",
  "ERP_API_KEY": "<完整值见配套受控 PDF>",
  "ERP_API_SECRET": "<完整值见配套受控 PDF>",
  "COMPANY": "Agentify Demo Co",
  "CURRENCY": "USD"
}
```

此处的 key/secret 用于示例共享访问。持有文档即能读取授权范围数据，不应将真实客户数据放入该共享范围。复制到 Render 时分别保存为环境变量，不要把整份含凭证文档提交代码仓库。

随后执行：

```bash
node tools/check-erp.mjs config.private.remote.json
node tools/configure.mjs remote
```

必须先看到身份匹配和三类记录列表/详情通过，再继续。自检不写 ERP 数据，不打印 key。身份匹配失败时核对凭证所属账号；403 时核对角色、公司与 DocType 权限；不要扩大权限到 Administrator。

停止本地 OpenWorker 的后端和 GUI。按 Step-2 重启两个终端，但将 `COWORKER_STATE_DIR` 改为 `$PROJECT_ROOT/.runtime/remote`。如需演示 Skill，另复制到该状态目录下的 workspace；本地目录的 Skill 不会自动同步。重新配置模型并新建会话，避免混用本地历史。

### 3.3 用业务证据证明切换成功

1. 在远程 ERP 网页选择真实单号，记录状态和金额；不要沿用本地样例单号。
2. 向 Agent 查询同一单据，检查工具结果与网页一致。
3. 停止自己的本地 ERP 容器，再查询远程另一张单据。结果仍成功，才能排除“其实还连着本地”。
4. 输入不存在的单号，确认不编造；要求修改记录，确认拒绝。

### Step-3 预期结果与注意事项

| 结果 | 必须满足 |
|---|---|
| 连接 | `origin` 是远程 HTTPS，认证身份等于配置中的 demo@agentist.org |
| 数据 | 至少一条真实记录完成列表、详情及 Agent 回答三方核对 |
| 环境 | 本地 ERP 停止后远程查询仍可用 |
| 权限 | 示例用户只能读取；不创建或轮换共享凭证 |
| 交付证据 | 脱敏自检输出、输入/答案、单号与执行时间；不上传配置文件 |

共享账号不能实现每个人的 ERP 级审计隔离；本项目演示的应用会话隔离不等于 ERP 业务租户隔离。对独立业务数据有要求时，须管理员分配独立身份与范围。

<!-- PAGEBREAK -->

## Step-4：部署到四平台 DevOps 环境

### 4.1 目标架构与部署顺序

```text
自定义域名 /erp-agent（Cloudflare DNS）
  → Vercel：Next.js 页面 + 服务端 API
      → Supabase：登录、私有会话与运行记录
      → Cloudflare Siteverify：防滥用验证
      → Render：app.py + OpenWorker + Node MCP
          → https://erp.agentist.org：既有远程 ERP
```

不是将 OpenWorker 桌面程序上传 Vercel。Vercel 放网页与 API 网关；Render 放已有常驻后端；Supabase 放应用身份与历史；Cloudflare 放域名与 Turnstile。ERP 本体继续由示例环境维护，不新增一台 ERP。

顺序：远程 API 自检通过 → 实现并本地验证 web → Supabase → Render → Vercel → Cloudflare → 外部用户联合验收。付费服务与磁盘创建前确认预算，不假设“没有请求就不收费”。

### 4.2 先把要部署的应用实现出来

配套包的 `backend/` 可复用；`web/` 是本项目需要实现的成果，不是已经存在的完整应用。可用 Next.js 官方项目初始化流程创建，固定版本并提交 lockfile。不要把整个示例平台 monorepo 直接部署到自己的账户：其付费资格检查、/lab basePath、数据库表和固定后端地址并不属于你的项目。

你的最小前端必须有 `/erp-agent`、登录/退出、聊天、本人会话列表、运行中/失败状态。建议使用 Supabase 邮箱密码测试用户，先由项目管理员在自己的 Supabase 建立两个用户；无需为了验证链路强行依赖尚未配置好的注册邮件或 Google OAuth。

服务端接口实现契约：

| 接口 | 必须完成的行为 |
|---|---|
| `POST /api/erp-agent/chat` | 验证登录、Origin、Turnstile、额度和会话归属；调用 Render 并保存结果 |
| `GET /api/erp-agent/sessions` | 只返回当前用户的会话 |
| `GET /api/erp-agent/sessions/:id` | 限定本人，其他人的 ID 返回 404 |

服务端从已核验的 Supabase 身份取得 UUID，不接受浏览器传入的可信 owner。Render 的实际调用格式如下，不是 OpenWorker 桌面服务的 `/v1` API：

```text
POST <你的 Render 地址>/v1/chat
Authorization: Bearer <AGENT_GATEWAY_TOKEN>
X-Agent-Owner: <服务端核验的 Supabase 用户 UUID>
Content-Type: application/json

{"message":"查询指定销售订单"}
```

后续对话追加 Render 返回的 `session_id`，由服务端保存映射，不能让浏览器任意指定他人的远端会话。响应为 `{session_id, request_id, events}`；从 assistant 消息事件提取回复，不把它误当成 `{reply: ...}`。原始事件先脱敏再展示，不暴露内部凭证或堆栈。

会话 ID、归属验证、并发锁、错误显示与历史持久化必须在本地验证后才部署。只把登录网页部署成功，不算完成 Agent 系统。

<!-- PAGEBREAK -->

### 4.3 Supabase：身份与应用记录

创建独立项目。最小表设计可为 `agent_sessions(id, owner, remote_session_id, turns, state, updated_at)`，owner 为用户 UUID；模型历史仍由 Render 保存，Supabase 存用户展示历史与归属。正式迁移文件必须纳入代码库。

本项目推荐业务表只允许服务端操作：开启 RLS，并撤销 anon/authenticated 不需要的表权限；浏览器只通过 Vercel API 读写。若服务端使用可绕过 RLS 的 secret/service-role key，每次查询与更新必须附加 owner 条件；RLS 不能替代此检查。若选择用户 JWT 直连表，则另行实现完整的按用户策略与负向测试。[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

按所用 Next.js 版本接入官方 SSR 方案，在服务端验证身份并处理 cookie 刷新。不要只检查 cookie 是否存在或信任未经核验的 session。不要用用户可编辑 metadata 决定访问权限。[Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs)

检查点：两个测试用户能够登录；A 的会话不被 B 读取/修改；匿名直接访问数据库也失败。回调配置按实际实现设置；使用 OAuth/邮件链接时，要加入本地与远程精确回调地址，不能指向示例平台。

### 4.4 Render：部署 Agent 后端

1. 把配套包的代码提交自己的仓库，不提交私有配置和 `.runtime`。
2. 创建 Docker Web Service，连接自己的仓库；Root Directory 选择 `backend`，Dockerfile 为该目录的 `Dockerfile`。若将 backend 内容单独作为仓库根，则 Root Directory 留空，不能重复写 backend。
3. Dockerfile 包含 Node 24、Python 3.12 与 npm 依赖。OpenWorker 必须使用修复仓库的维护分支提交，旧配套包须将 pip 依赖改为下方值；不要继续安装原上游旧提交。使用现有 CMD，不覆盖为 `npm start`。

```text
coworker @ git+https://github.com/mrvgao/openworker.git@30d6e9a0144868caf37e780d70003f03ff520a87
```
4. 保持单实例、单 worker。设置 Health Check Path 为 `/healthz`。服务监听 `0.0.0.0` 和平台 PORT。[Render Web Service](https://render.com/docs/web-services)
5. 使用支持持久磁盘的服务计划，挂载 `/var/data`；保持 `AGENT_DATA_DIR=/var/data/agent`。启动日志若出现 Permission denied，检查运行 UID 10001 对挂载目录的写权限，不把状态改写到临时目录来掩盖问题。持久磁盘不是多实例共享盘，也不保证零停机发布。[Render 磁盘](https://render.com/docs/disks)

在 Render 添加下列环境变量：

| 变量 | 值与说明 |
|---|---|
| `ERP_URL` | `https://erp.agentist.org` |
| `ERP_API_KEY` / `ERP_API_SECRET` | Step-3 已通过自检的远程受限凭证 |
| `ERP_PROFILE_JSON` | `.runtime/remote/profile.json` 的完整 JSON；不是文件路径 |
| `OPENAI_API_KEY` | 自己可用的模型凭证；模型名称与提供商须对应 |
| `AGENT_MODEL` | 现有默认 `gpt-4.1-mini`；先确认账户可用 |
| `AGENT_OPERATOR_TOKEN` | 独立随机字符串，至少 32 字符；即使只用网关也必须设置 |
| `AGENT_GATEWAY_TOKEN` | 另一条独立随机字符串，至少 32 字符；Vercel 保存相同值 |
| `AGENT_RUNS_PER_HOUR` | 参考值 30；当前实现是实例全局额度，不是每用户额度 |
| `AGENT_DATA_DIR` | `/var/data/agent` |

可在自己的终端分别运行两次 `openssl rand -hex 32` 生成两个 token，存入密码管理器；不要提交 Git 或复制到公共截图。Render 注入的是环境变量的值，不要额外把值包成带字面引号的字符串。

当前 app.py 会校验 profile.actions 必须且仅有 `erp.query` 和 `erp.get`，并在启动阶段连接 ERP。无 API 凭证、身份不符或 profile 多了写操作，服务可能无法通过启动检查。不要用 health check path 改名掩盖启动失败。

服务成功后：未带认证调用 `/v1/tools` 应为 401；使用 operator token 可看见两项工具。以一次受控模型请求验证 `/v1/chat`，记录 request_id；healthz 200 不能单独代表模型可用。

Skill 特别说明：提供的远程 app.py 尚未注册 SkillLoader/load_skill。Step-2 的本地 Skill 不会自动上线。基础 Step-4 验收是只读查询；如要求远程 Skill，需另行接入受限技能加载、将文件 COPY 到镜像并验证加载事件，不能仅上传 SKILL.md 就声称完成。

<!-- PAGEBREAK -->

### 4.5 Vercel：部署网页与服务端网关

在 Vercel 导入自己的仓库，Root Directory 为 `web`；使用 Next.js 预设和对应 lockfile。部署前本地 `npm run build` 必须通过。配置按你的代码实际变量名填写，推荐如下：

| 变量 | 使用位置 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 可公开的项目 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 可公开 publishable key；不是 secret |
| `SUPABASE_SECRET_KEY` | 仅服务端数据库操作；如代码使用 legacy service-role 则按实现配置 |
| `AGENT_API_URL` | 你的 Render HTTPS 根地址，不是示例服务，不是 ERP_URL |
| `AGENT_GATEWAY_TOKEN` | 与你的 Render 相同，不能带 NEXT_PUBLIC_ 前缀 |
| `APP_ORIGIN` | 当前部署的精确 origin，供 Origin 校验；不带路径 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 前端 widget 使用 |
| `TURNSTILE_SECRET_KEY` | 服务端 Siteverify 使用 |

这是一套建议变量命名，不会自动改写你的代码。部署前逐项核对实际读取的变量。Preview 与 Production 分别配置；设置后重新部署。在 Vercel 域名、正式域名之间切换时，同步更新 Origin、登录回调与 Turnstile hostname。

参考后端运行超时 120 秒；网关取 135 秒超时并为保存结果留余量。Next.js 路由的 maxDuration 需由所用 Vercel 计划支持，例如选用至少 150 秒的配置。若不支持，先缩短后端任务预算或实现持久化异步任务，不通过无限重试解决。网页断开不代表后端停止；未知结果标记 uncertain，不自动重发。[Vercel 函数限制](https://vercel.com/docs/functions/limitations)

如果部署保护弹出 Vercel 团队登录，说明还未提供对验收者可用的入口。按项目规则配置可访问方式；不要因此移除应用自身的 Supabase 鉴权。Vercel 到 Render 是服务端请求，不需要把网关 token 发给浏览器来“解决 CORS”。

### 4.6 Cloudflare：域名与防滥用

1. 选择自己的 `agent.<你的域名>`，或经授权分配的子域名。在 Vercel 添加它，复制该项目实际提示的 DNS 记录到 Cloudflare。
2. 先用 DNS-only 完成 HTTPS 与应用访问，再考虑代理增强。DNS-only 不经过 Cloudflare HTTP 代理，不能声称启用了 WAF。DNS 不能路由 `/erp-agent`，这条路径由 Next.js 实现。[域名配置](https://vercel.com/docs/domains/working-with-domains/add-a-domain)、[代理状态](https://developers.cloudflare.com/dns/proxy-status/)
3. 创建自己的 Turnstile widget，允许实际前端 hostname；如需要本地测试，按官方测试配置独立处理，不把生产 secret 发给浏览器。
4. 服务端在触发模型前调用 Siteverify，检查成功、hostname 和预期 action；失败时拒绝新推理。token 五分钟过期且单次有效，重新提交需要新 token。[Turnstile 验证](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
5. 服务端还须实现按用户额度，Render 的全局 30 次/小时不能替代它。Turnstile 也不能替代登录或权限。

示例平台 `agentist.org/erp-agent` 与 `test.agentist.org/erp-agent` 不是你的可自由部署域名。最终交付自己的 URL，或明确获配的子域名；保留本地/远程 `/erp-agent` 后缀。

### Step-4 预期结果

关闭本机 ERP 与 OpenWorker，换一个浏览器或另一台设备打开自己的 HTTPS URL，登录后查询远程 ERP 成功，刷新历史保留；另一个用户无法查看该会话。所有模型与 ERP 凭证留在服务端，业务单据没有被修改。

<!-- PAGEBREAK -->

## 5. 联合验收与排障矩阵

| 编号 | 验收动作 | 必须观察到的结果 |
|---|---|---|
| P1 | 本地 ERP 登录与普通模型对话 | 两者分别成功，版本和端口明确 |
| P2 | 本地 API 自检 + Agent 查询一张订单 | 身份一致，详情字段与 ERP 页面一致 |
| P3 | 加载本地业务 Skill | 有加载记录；没有把开票率解释为回款率 |
| P4 | 远程 API 自检 | 三类记录读取通过，origin 为远程 HTTPS |
| P5 | 停止本地 ERP 后重复远程查询 | 仍成功，无本地地址依赖 |
| P6 | 关闭全部本机服务后访问自己的域名 | 远程应用仍可登录、查询 |
| P7 | 未登录请求 / Render 错误 token | 拒绝，不触发推理 |
| P8 | B 使用 A 的会话 ID | 拒绝读取和修改，无串号 |
| P9 | 无效、缺失、重放 Turnstile token | 拒绝且没有新模型运行 |
| P10 | 请求取消或修改远程订单 | 拒绝，ERP 原记录未变 |
| P11 | 刷新页面、重启 Render | 展示历史保留；引擎会话持久化可验证 |
| P12 | 模型或 ERP 请求失败 | 有错误与 request_id；不谎称成功、不自动重复未知操作 |

正确率检查：选 5 条固定查询，各执行 3 次，报告正确次数/15、错误分类与延迟。安全项必须全部通过。不要将一次成功聊天称为生产稳定性证明。

### 排障按层进行，不要反复重装

| 现象 | 先查哪里 | 正确处理 |
|---|---|---|
| 本地 8080 无页面 | create-site / db / frontend 日志 | 确认建站完成、端口与镜像平台；不删除数据卷 |
| OpenWorker 页面连接失败 | 8765 与两端状态目录 | 先后端后 GUI；重启后刷新 token |
| 没有 ERP 工具 | mcp.json、Node 24、npm 安装、启动 stderr | 查看准确文件路径与权限；stdio 等待输入不是 HTTP 服务 |
| API 401 / 身份不一致 | key/secret 是否属于目标 ERP | 不把密码当 secret；向管理员重新确认 |
| API 403 | ERP 角色、公司、DocType | 只补任务所需权限，不改成 Administrator |
| API 200 但列表空 | 记录范围与本地初始化 | 空数据不等于网络故障，不编造结果 |
| Render 无法健康启动 | profile JSON、API 身份、磁盘权限 | 核对完整 JSON、只读 actions、UID 写入权限 |
| Vercel 502 | 网关地址/token、owner UUID、Render 日志 | 先定位鉴权还是模型失败，不直接重试 |
| 页面可访问但登录失效 | Supabase 回调/SSR、APP_ORIGIN | 同步精确域名、环境变量并重新部署 |
| 运行历史丢失 | Supabase 表权限、Render 挂载路径 | 区分展示历史与模型上下文两个存储 |
| 平台域名能用，自定义域名不能用 | DNS/证书/Turnstile hostname | 先 DNS-only，按 Vercel 实际记录核对 |

## 6. 交付清单与发布门槛

- 代码仓库与 commit；锁文件、Dockerfile、无密钥配置模板、数据库迁移。
- 自己的远程 URL、验收账号的私密交付方式。
- 每一步的检查结果、P1-P12 证据、15 次查询统计。
- 运行手册：如何查看日志、停止新推理、轮换密钥、回滚与停止收费资源。
- 已知限制：ERPNext 本地/远程版本差异、共享只读身份、远程 Skill 是否实现、并发与额度。

放行门槛：G0 远程 API 凭证已在受控 PDF 提供并完成复验；G1 本地两服务通过；G2 本地真实工具链通过；G3 远程 API 与 Agent 通过；G4 四平台外部用户测试通过。任一项未通过，应明确记录为未完成，不让下一位实施者靠猜测绕过。

## 7. 维护者核验记录

本次修订已核对维护分支及安装脚本，并统一本地仓库与部署依赖。新分支未重跑整套安装与部署验收；下列测试记录来自修订前，不能视为新版本通过证明。

配套包验证：3 项 Node 自检、5 项身份测试及配置检查通过；原生 OpenWorker MCP 使用包内连接器查询远程订单通过。本次 demo@agentist.org 新 API 凭证的身份及三类单据列表/详情自检全部通过；测试只读，无模型调用。

未完成：新电脑的 ERPNext v15.72.1 干净安装、配套包未提供的 web 实现、新账户四平台端到端验收。这些必须按门槛补齐，不能从示例环境已有部署推导为“所有人复制即可成功”。
