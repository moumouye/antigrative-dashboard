# Antigrative Dashboard v0.8.19

接管上游维护源，新增独立安装脚本与一行命令网络安装，增强用量账本聚合与稳定性。

- **独立主源接管**：原上游仓库注销后，本仓库正式接管为主维护源。修复应用内自动更新检查通道与组件文档外链，确保后续更新平滑过渡。
- **一键独立安装器（免克隆）**：
  - 新增单文件安装器 `install.py`，支持直接网络下载校验安装。
  - 支持 macOS / Linux `curl -fsSL https://raw.githubusercontent.com/moumouye/antigrative-dashboard/main/install.py | python3`。
  - 支持 Windows PowerShell `irm https://raw.githubusercontent.com/moumouye/antigrative-dashboard/main/install.ps1 | iex`。
- **统一用量账本（Unified Usage Ledger）**：优化设备级 Token 用量聚合，避免多会话并发竞争，提升大数据量下历史记录扫描与渲染性能。
- **全平台特性保持**：
  - Windows TUN 模式端口识别与假 IP LISTENING 过滤。
  - 独立区分 Gemini Argon 周额度（Gemini (Argon)）。
  - Antigravity IDE 2.6.0+ 与 App 2.21.1 / 2.22.0 完整兼容。

## 安装与更新

- **一键在线安装（推荐）**：
  - macOS / Linux：`curl -fsSL https://raw.githubusercontent.com/moumouye/antigrative-dashboard/main/install.py | python3`
  - Windows：`irm https://raw.githubusercontent.com/moumouye/antigrative-dashboard/main/install.ps1 | iex`
- **源码克隆与本地安装**：
  ```bash
  git clone https://github.com/moumouye/antigrative-dashboard.git
  cd antigrative-dashboard
  python manage.py install
  ```
- **CLI 状态栏安装**：在仓库目录运行 `python manage.py install-cli`。

[兼容性文档](https://github.com/moumouye/antigrative-dashboard/blob/main/COMPATIBILITY.md) · [CLI 使用说明](https://github.com/moumouye/antigrative-dashboard/blob/main/docs/CLI.md)
