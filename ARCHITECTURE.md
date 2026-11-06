# 系统总架构指南 (System Master Architecture)

本仓库（`moumouye/antigrative-dashboard`）为主维护源，承载 Antigravity Pulse（用量分析与监控仪表板）的全链路开发、发版与治理。
核心设计遵循：**零第三方运行时依赖、宿主零侵入（严禁篡改 `app.asar`）、设备级统一账本、单脚本跨平台极简安装**。

---

## 两层工程真理体系 (Two-Tier Architecture Pyramid)

系统知识严格按两层金字塔架构分层维护：

```mermaid
flowchart TD
    Hub["<b>ARCHITECTURE.md (总架构地图)</b><br/>系统拓扑、模块导航、真理库总控"]

    subgraph Layer1 ["第一层：工程治理与物理红线 (Governance Invariants)"]
        Doc1["<b>① 边界与红线 (Boundaries)</b><br/><code>docs/boundaries.md</code><br/>宿主安全、数据隐私与模块不可逾越红线"]
        Doc2["<b>② 契约与流向 (Contracts)</b><br/><code>docs/contracts.md</code><br/>渲染注入、跨进程 IPC、安装引导与版本发布契约"]
        Doc3["<b>③ 否决与避坑档案 (Anti-Patterns)</b><br/><code>docs/anti-patterns.md</code><br/>暗知识档案：实测被否决的方案与失效根因剖析"]
        Doc4["<b>④ 质量验收门禁 (Verification)</b><br/><code>docs/verification.md</code><br/>自动化门禁、物理不变量断言与反向防倒退锁"]
    end

    subgraph Level2 ["子模块局部规范 (Level 2 Modular AGENTS)"]
        M1["<code>cli/AGENTS.md</code><br/>CLI 终端管道规范"]
        M2["<code>ide/AGENTS.md</code><br/>VS Code 扩展规范"]
        M3["<code>sidecars/panel/AGENTS.md</code><br/>守护进程与数据规范"]
    end

    subgraph Layer2 ["第二层：核心领域协议与算法规范 (Domain Specifications)"]
        S1["<code>docs/USAGE.md</code><br/>Token会计与子代理聚合"]
        S2["<code>docs/TPS.md</code><br/>Median/MAD速率算法"]
        S3["<code>docs/CONTEXT_LIMITS.md</code><br/>模型窗口与容量预警"]
        S4["<code>docs/LONG_CONVERSATIONS.md</code><br/>长会话切片与SQLite"]
        S5["<code>docs/CLI.md</code><br/>终端状态行管道协议"]
        S6["<code>docs/ROBUSTNESS.md</code><br/>容灾自愈状态机矩阵"]
        S7["<code>docs/UPDATES.md</code><br/>原子更新与NTFS兼容"]
    end

    Hub ==> Layer1
    Hub ==> Level2
    Hub ==> Layer2
```

---

## 全局系统拓扑 (System Topology)

```mermaid
flowchart TD
    subgraph Distribution ["分发与安装通道 (Distribution & Bootstrap)"]
        GH["GitHub Releases / 源码主干"]
        InstallPy["install.py (单文件通用 Python 引导器)"]
        InstallPs1["install.ps1 (Windows PowerShell 引导器)"]
        Updater["compat/update-worker.py (后台异步更新探测)"]
        GH -->|HTTP GET 单行管道| InstallPy
        GH -->|HTTP GET 单行管道| InstallPs1
        Updater -.异步检查更新.-> GH
    end

    subgraph Host ["Antigravity 宿主环境 (Host Context)"]
        App["Electron 桌面宿主"]
        IDE["VS Code Fork (IDE 宿主)"]
        PatchLoader["compat/runtime-ui.mjs (运行时补丁挂载器)"]
        App --> PatchLoader
    end

    subgraph Rendering ["双端渲染注入层 (Dual Rendering Ingestion)"]
        ViewResolver["compat/usage-view.mjs<br/>视图路径唯一解析收口"]
        InlineWidget["compat/inline-widget.cjs<br/>Shadow DOM 容器挂载器"]
        UsageView["compat/usage-ui.cjs<br/>统一用量看板 (24h 日内分布 / 成本测算)"]
        
        PatchLoader -->|源码文本注入| InlineWidget
        IDE -->|源码文本注入| InlineWidget
        ViewResolver -->|单一权威视图| UsageView
        InlineWidget -->|window.__agPulseUsageFactory| ViewResolver
    end

    subgraph SidecarLayer ["本地服务与数据层 (Sidecar & Local Engine)"]
        Sidecar["sidecars/panel/main.mjs<br/>本地守护服务 (Loopback 桥接)"]
        Pricing["sidecars/panel/pricing.mjs<br/>静态价格表与离线计费引擎"]
        Ledger["sidecars/panel/usage.mjs<br/>设备级统一用量账本"]
        Worker["sidecars/panel/usage-disk-worker.mjs<br/>异步磁盘归档 Worker"]
        Store["sidecars/panel/store.mjs<br/>指标与会话元数据存储"]

        PatchLoader -->|IPC 桥接| Sidecar
        IDE -->|IPC 桥接| Sidecar
        Sidecar --> Pricing
        Sidecar --> Store
        Sidecar --> Ledger
        Ledger --> Worker
    end

    subgraph Storage ["物理磁盘存储 (Local Disk)"]
        DiskLedger["~/.gemini/antigravity/usage/<br/>统一账本物理落盘 (.jsonl)"]
        Worker --> DiskLedger
    end
```

---

## 核心文档全景地图 (Documentation Sitemap)

### 第一层：工程治理与物理红线
| 文档路径 | 核心职责 | 查阅契机 |
| :--- | :--- | :--- |
| [`docs/boundaries.md`](docs/boundaries.md) | 架构物理红线、沙箱隔离、数据隐私边界 | 涉及文件系统、外部网络、跨平台兼容性设计时 |
| [`docs/contracts.md`](docs/contracts.md) | Webview 注入协议、打包清单、安装与发布协议 | 接口调整、渲染管道变更、版本发布时 |
| [`docs/anti-patterns.md`](docs/anti-patterns.md) | 实测已否决方案、技术陷阱与失效根因记录 | 技术选型、避免重蹈覆辙时必查 |
| [`docs/verification.md`](docs/verification.md) | 质量门禁矩阵、CDP 自动化、四大物理不变量 | 任何代码提交、发版、缺陷反向断言维护前 |
| [`CHANGELOG.md`](CHANGELOG.md) | 全版本演进与发布记录 | 追溯特定版本功能特性与修复流水 |
| [`COMPATIBILITY.md`](COMPATIBILITY.md) | 跨平台系统矩阵与运行环境规范 | 查阅支持的操作系统、宿主版本与数据目录时 |

### 第二层：核心领域协议与算法规范
| 文档路径 | 核心业务领域 | 查阅契机与强绑定代码 |
| :--- | :--- | :--- |
| [`docs/TPS.md`](docs/TPS.md) | 流式输出速率算法、Median/MAD 去噪、TTFT 剥离准则 | 改动 `sidecars/panel/metrics.mjs` 时必读并同步 |
| [`docs/USAGE.md`](docs/USAGE.md) | Token 会计口径、子代理树状聚合与 Cache 命中率 | 改动 `sidecars/panel/usage.mjs` 时必读并同步 |
| [`docs/CONTEXT_LIMITS.md`](docs/CONTEXT_LIMITS.md) | Gemini 模型容量窗口、输入预算与压缩预警模型 | 改动 `sidecars/panel/pricing.mjs` 时必读并同步 |
| [`docs/LONG_CONVERSATIONS.md`](docs/LONG_CONVERSATIONS.md) | 超长会话流式分块协议、8MB 内存上限、SQLite 持久化 | 改动 `sidecars/panel/usage-disk-worker.mjs` 时必读并同步 |
| [`docs/CLI.md`](docs/CLI.md) | CLI 状态行管道协议、Argon 额度解析与 ANSI 终端输出 | 改动 `cli/*.mjs` 时必读并同步 |
| [`docs/ROBUSTNESS.md`](docs/ROBUSTNESS.md) | 跨平台容灾、网络重试与进程自愈状态机 | 调整网络超时、重连逻辑与服务生命周期时 |
| [`docs/UPDATES.md`](docs/UPDATES.md) | 应用原子更新机制、NTFS Junction 兼容与事务锁 | 改动 `sidecars/panel/updater.mjs` 时必读并同步 |
