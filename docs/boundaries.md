# ① 边界与红线 (Boundaries & Constraints)

本文档定义本项目的系统架构物理红线、模块职责划分与不可逾越的技术边界。

---

## 1. 核心架构红线 (Non-negotiable Architectural Invariants)

系统在任何功能演进与重构中，必须无条件遵守以下物理红线：

### ① 宿主完整性保护红线 (Host Non-Invasive Invariant)
* **严禁篡改 `app.asar`**：严禁解包、修补或覆盖 Electron 宿主程序的 `resources/app.asar` 核心归档。所有能力增强必须通过运行时加载器（`compat/runtime-ui.mjs`）或 VS Code 插件协议进行非破坏性挂载；
* **卸载与禁用自愈性**：移除插件或停用 sidecar 时，宿主环境必须能够即刻回退至纯净基线状态，不得在宿主目录残留破损配置或使宿主进程陷入启动崩溃。

### ② 数据隐私与离线零外流红线 (Data Privacy & Zero Egress)
* **零外部遥测与数据外泄**：所有的 Token 统计、耗时指标、会话元数据与轨迹分析，数据生产、计算与消费物理链路 100% 局限于本地设备；
* **本地回环网络隔离**：本地服务通信（IPC / HTTP Bridge）严格绑定 `127.0.0.1`，严禁监听 `0.0.0.0`，严禁在公网暴露任何控制端点；
* **计费引擎离线计算**：价格表（`sidecars/panel/pricing.mjs`）为纯静态硬编码字典，人民币与美元成本估算纯本地完成，严禁发起外部汇率或价格网络请求；
* **凭据与正文隔离**：用量分析仅提取数值元数据（Prompt Tokens、Completion Tokens、Model Name），严禁收集、解析或向磁盘持久化任何用户对话正文、Prompt 提示词或敏感认证密钥。

### ③ 零依赖与极简运行红线 (Zero External Dependencies)
* **零生产环境 npm 依赖**：生产运行态不依赖 `node_modules`，不引入外部构建器（Webpack、Vite、Rollup）。运行时使用原生 Node.js ESM (`.mjs`) 与 Webview 专用的 CommonJS (`.cjs`)；
* **零外部 pip 依赖**：安装引导器（`install.py`）、打包工具（`manage.py`）及发布工具（`tools/publish-release.py`）必须仅使用 Python 3 标准库（`urllib`, `json`, `zipfile`, `shutil`, `sys`, `os`），确保在任何全新机器上开箱即跑；
* **零运行时构建黑盒**：严禁在运行路径中引入任何即时编译（JIT/Babel/TS 转译）步骤，保持源码直读与透明调试。

### ④ 持久化安全与幂等归档红线 (Storage Safety & Idempotent Migration)
* **设备级统一账本**：用量数据按设备全局作用域唯一落盘于 `~/.gemini/antigravity/usage/`；
* **历史数据零删除原则**：在对旧版多账户分散目录执行收敛迁移时，严禁使用物理删除（`rm -rf`）；必须将旧目录原子移动至 `.merged-<uuid>/` 备份归档目录，确保极端故障下数据可恢复。

---

## 2. 模块职责与技术栈边界 (Module Responsibilities)

| 模块层级 | 物理路径 | 运行环境 / 技术栈 | 职责边界（只准做什么，严禁做什么） |
| :--- | :--- | :--- | :--- |
| **安装与引导器** | `install.py`, `install.ps1` | Python 3 标准库 / PowerShell 原生 | **准**：跨平台单行安装、下载 Release 归档、校验解压、创建软链/快捷方式。<br/>**严禁**：安装 pip/npm 依赖、修改系统全局变量。 |
| **运行时注入层** | `compat/runtime-ui.mjs`, `compat/inline-widget.cjs` | Node.js ESM / CJS (宿主渲染环境) | **准**：向宿主注入 Shadow DOM 挂载点、分发全局事件、提供页面加载入口。<br/>**严禁**：直接修改宿主原生 DOM 树根节点、阻塞主线程渲染。 |
| **用量看板视图** | `compat/usage-ui.cjs`, `compat/usage-view.mjs` | 原生 DOM API / CJS 模块源码文本 | **准**：渲染 24 小时日内图表、Token 筛选、费用计算、多语言呈现。<br/>**严禁**：直接进行磁盘 I/O 操作；数据必须统一从 Sidecar 获取。 |
| **本地服务进程** | `sidecars/panel/main.mjs`, `sidecars/panel/usage.mjs` | Node.js ESM 原生进程 | **准**：监听 Loopback IPC、聚合统计账本、管理会话历史、调度后台写入。<br/>**严禁**：跨主机网络通信、明文记录敏感 Prompt。 |
| **异步落盘 Worker** | `sidecars/panel/usage-disk-worker.mjs` | Node.js Worker 线程 / 子进程 | **准**：批量缓冲、单向追加写入 JSONL 账本文件。<br/>**严禁**：与 UI 线程产生同步阻塞式调用。 |
| **IDE 适配层** | `ide/main.mjs`, `ide/surface.cjs` | VS Code Extension API | **准**：为 VS Code/IDE 宿主注入相同规范的用量视图工厂。<br/>**严禁**：绕过 `usage-view.mjs` 解析器直接硬编码私有文件路径。 |
| **治理与门禁工具** | `tools/local-gate.mjs`, `tools/check-*.mjs` | Node.js ESM 原生 (系统 Chrome CDP) | **准**：零依赖运行自动化门禁、执行物理不变量断言。<br/>**严禁**：为门禁引入笨重的外部无头测试驱动（如安装整个 Playwright 运行时作为硬性前提）。 |

---

## 3. 架构硬禁区 (Architectural Hard Forbidden Zones)

1. **严禁破坏模块寻址规范**：所有 Webview 渲染视图必须统一走 `compat/usage-view.mjs` 解析器收口，严禁硬编码私有加载路径（详见 [`docs/anti-patterns.md`](anti-patterns.md) AP-001）；
2. **严禁目录重排或文件随意重命名**：文件路径被测试 glob、打包清单、CI 流程与运行时动态加载硬编码约束，任意重命名将打断三处以上链路；
3. **严禁在发布链路强耦合二进制产物**：发布流程必须支持纯文本状态广播（`--text-only`），严禁强制断言本地构建文件存在（详见 AP-002）。
