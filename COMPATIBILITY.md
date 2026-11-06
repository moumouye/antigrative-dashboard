# 兼容性与运行环境规范 (Compatibility & Specifications)

本文档定义 Antigravity Pulse 面向各操作系统、Antigravity 宿主版本及运行环境的技术规范与兼容性矩阵。

---

## 1. 跨平台支持矩阵 (Platform Support Matrix)

| 操作系统 | 安装与后台进程发现 | 端口与调试连接 | 验证状态 |
| :--- | :--- | :--- | :--- |
| **Windows** | Python 3 / PowerShell，CIM 筛选 standalone 进程并配合 netstat 校验端口所有权 | 严格过滤 TUN 虚拟网卡 `LISTENING` 假 IP，支持 `State: 0` 兼容探测 | Windows 11 / 桌面 App 2.21.1、2.22.0、2.28.x；真实对话实机验收通过 |
| **macOS** | Python 3 / POSIX shell，当前用户 `ps` 与 `lsof` 校验 PID 所属端口 | 优先读取 `~/Library/Logs/Antigravity/language_server.log` 端口提示 | macOS 14+ / 桌面 App 2.21.1、2.28.x；本地及自动化 CI 检验通过 |
| **Linux** | Python 3 / POSIX shell，当前用户 `/proc` 与 TCP socket inode 检索 | 读取 `${XDG_CONFIG_HOME:-~/.config}/Antigravity/logs/` 端口提示 | Ubuntu 22.04+ CI 原生端口与生命周期检验通过 |

---

## 2. 宿主程序与运行环境要求 (Host & Runtime Requirements)

* **Antigravity 桌面 App**：支持 2.21.1、2.22.0、2.28.0、2.28.2 及后续版本；
* **Antigravity 自带 IDE**：支持 2.5.5（VS Code base 1.107.0）及 2.6.0+（支持 `agy --hub` 后台协议）；
* **Node.js 环境**：要求宿主内置或系统 Node.js 22.13+（推荐 Node 24），需支持原生 WebSocket 与 `node:sqlite`（用于超长会话异步落盘）；
* **Python 环境**：仅安装与生命周期脚本使用 Python 3.10+，零第三方 pip 依赖；
* **非目标宿主**：暂不支持 Visual Studio、JetBrains、Zed、Xcode 或移动端。

---

## 3. Antigravity IDE 扩展挂载规范 (IDE Integration)

IDE 端专用包为 `antigrative-dashboard-ide-*.vsix`，安装与配置独立于桌面端：
* **挂载通道**：IDE 需通过 Loopback 调试端口挂载。完全退出后通过附加参数启动：
  ```bash
  --remote-debugging-port=0 --remote-debugging-address=127.0.0.1
  ```
* **存储独立性**：IDE 端用户数据保存在其自身 global storage 目录，与桌面 App 的配置完全隔离；
* **详细指引**：详见 [ide/README.md](ide/README.md)。

---

## 4. 独立用户数据与配置目录 (Data & Config Directories)

| 内容 | Windows | Linux | macOS |
| :--- | :--- | :--- | :--- |
| **宿主配置目录** | `%APPDATA%/Antigravity` | `${XDG_CONFIG_HOME:-~/.config}/Antigravity` | `~/Library/Application Support/Antigravity` |
| **插件安装根目录** | `~/.gemini/config/plugins/antigravity-pulse` | `~/.gemini/config/plugins/antigravity-pulse` | `~/.gemini/config/plugins/antigravity-pulse` |
| **用户偏好设置** | `%LOCALAPPDATA%/AntigravityPulse/preferences.json` | `${XDG_DATA_HOME:-~/.local/share}/AntigravityPulse/preferences.json` | `~/Library/Application Support/AntigravityPulse/preferences.json` |
| **备份归档目录** | `%LOCALAPPDATA%/AntigravityPulseBackups` | `${XDG_DATA_HOME:-~/.local/share}/AntigravityPulseBackups` | `~/Library/Application Support/AntigravityPulseBackups` |
| **设备级统一账本** | `~/.gemini/antigravity/usage/` | `~/.gemini/antigravity/usage/` | `~/.gemini/antigravity/usage/` |

> [!NOTE]
> 更新、重装或卸载插件均会严格保留已落盘的统一用量账本（`usage/`）与偏好设置，绝不执行破坏性物理删除。

---

## 5. 安装路径与环境变量覆盖 (Installation & Overrides)

### 默认搜索路径
* **Windows**：当前用户 AppData 安装目录；
* **macOS**：`/Applications/Antigravity.app` 或 `~/Applications/Antigravity.app`；
* **Linux**：`/opt/Antigravity`、`/opt/antigravity`、`/usr/share/antigravity` 以及系统 PATH。

### 可用环境变量覆盖
| 环境变量 | 作用 |
| :--- | :--- |
| `AG_PULSE_APP_ASAR` | 显式覆盖宿主 `app.asar` 的检测路径（仅用于定位宿主版本，严禁写入修改） |
| `AG_PULSE_PROFILE` | 安装时显式指定宿主用户配置目录 |
| `AG_PULSE_LOG` | 显式指定唯一的语言服务器日志路径，跳过自动发现 |
| `ANTIGRAVITY_AGENTAPI_EXE` | 显式指定外部语言服务器可执行文件路径 |

---

## 6. 挂载与安全物理策略 (Security & Mounting Policies)

1. **宿主零侵入原则**：严禁修改宿主 `resources/app.asar`，所有挂载均通过运行时脚本注入或扩展机制无损挂载；
2. **纯本地回环通信**：Sidecar 守护进程与 Webview 桥接 100% 绑定 `127.0.0.1`，拒绝任何公网访问；
3. **敏感凭据与正文隔离**：仅读取模型名称与数值 Token 元数据，严禁持久化用户 Prompt 或对话上下文。
