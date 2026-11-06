<div align="center">

<img src="docs/assets/hero-zh.png?v=0.8.0" width="100%" alt="Antigrative Dashboard：输入框旁的实时指标监控控件">

# Antigrative Dashboard

**专为 Google Antigravity 打造的原生级性能与用量仪表盘**<br>
无需离开对话界面，在模型选择栏旁实时掌控生成速率、缓存命中率、上下文占用与账号多维额度。

[![Version 0.8.19](https://img.shields.io/badge/version-0.8.19-91adff?style=flat-square&labelColor=252936)](CHANGELOG.md)
[![Platforms](https://img.shields.io/badge/host-Windows%20%7C%20Linux%20%7C%20macOS-83d8b9?style=flat-square&labelColor=252936)](COMPATIBILITY.md)
[![Antigravity 2.21.1 / 2.22.0](https://img.shields.io/badge/Antigravity-2.21.1%20%2F%202.22.0-c5a0ff?style=flat-square&labelColor=252936)](COMPATIBILITY.md)
[![MIT](https://img.shields.io/badge/license-MIT-d4d9e6?style=flat-square&labelColor=252936)](LICENSE)

[⚡️ 快速安装](#-快速安装) · [✨ 核心特性](#-核心特性) · [🛠 日常管理](#-日常管理) · [💻 多端支持](#-多端支持) · [常见问题](#-常见问题) · [English Version](README.en.md)

</div>

---

## ⚡️ 快速安装

免克隆、零依赖（仅需 Python 3.10+），在终端执行一行命令即可全自动安装并启用：

### macOS / Linux
```bash
curl -fsSL https://raw.githubusercontent.com/moumouye/antigrative-dashboard/main/install.py | python3
```

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/moumouye/antigrative-dashboard/main/install.ps1 | iex
```

> **安装后生效**：完全退出并重新打开 Antigravity 客户端，进入任一对话，即可在输入框模型选择旁看到常驻监控条。

<details>
<summary><strong>喜欢手动克隆或离线部署？点击展开</strong></summary>

```bash
git clone https://github.com/moumouye/antigrative-dashboard.git
cd antigrative-dashboard
python manage.py install   # Linux / macOS 使用 python3
```
</details>

---

## 📸 效果预览

<table>
<tr><th width="50%">生成速度与 Token 缓存</th><th width="50%">上下文与多模型额度</th></tr>
<tr>
<td width="50%" valign="top">
  <img src="docs/assets/speed-zh.png?v=0.8.0" width="100%" alt="生成速度详情卡"><br>
  <img src="docs/assets/widget-zh.png?v=0.8.0" width="100%" alt="Token 用量与缓存详情卡">
</td>
<td width="50%" valign="top">
  <img src="docs/assets/context-zh.png?v=0.8.0" width="100%" alt="上下文与额度详情卡">
</td>
</tr>
</table>

<table>
<tr><th width="50%">每日 / 每周活跃热力图</th><th width="50%">模型用量明细与统计</th></tr>
<tr>
<td width="50%">
  <img src="docs/assets/usage-overview-zh.png?v=0.8.0" width="100%" alt="Token 活动概览热力图">
</td>
<td width="50%">
  <img src="docs/assets/usage-details-zh.png?v=0.8.0" width="100%" alt="模型用量柱状统计图">
</td>
</tr>
</table>

---

## ✨ 核心特性

- **🚀 实时性能监控**：精确计算加权每秒 Token 数（tok/s）、单次请求生成速度、首字延迟（TTFT）以及工具调用耗时。
- **📊 额度精准把控**：清晰区分 Gemini、Claude/GPT 的 5 小时与每周额度，独立识别 Gemini 4 Argon 专属周额度，实时展示重置倒计时。
- **🎯 深度缓存透明化**：以 DSH 风格展示未缓存输入、缓存读取与输出 Token，直观掌握当前请求的高速缓存命中率。
- **📈 内置交互式看板**：点击即可呼出用量总览，支持日/周/月跨度筛选、按模型聚合消耗、查看 24 小时活跃走势图。
- **🎨 智能自适应体验**：
  - **主题与语言**：无缝跟随 Antigravity 原生明暗主题；支持简体中文、繁體中文与英文并记住偏好。
  - **自适应紧凑布局**：窗口变窄时自动折叠为小图标并保持悬停交互，不遮挡输入区与功能按钮。
- **🔒 纯本地与数据安全**：所有数据均通过本机 Loopback 端口读取并本地持久化，绝不将你的指标或对话上传到任何第三方服务器。

---

## 🛠 日常管理

在源码目录（默认位于 `~/.gemini/antigrative-dashboard`）执行管理命令：

| 操作 | 命令 | 说明 |
| :--- | :--- | :--- |
| **检查状态** | `python manage.py status` | 查看插件安装位置、挂载模式与连接健康状态 |
| **临时停用** | `python manage.py disable` | 暂时禁用插件，在下一次轮询时隐藏监控条 |
| **重新启用** | `python manage.py enable` | 恢复插件并重新显示监控条 |
| **完整卸载** | `python manage.py uninstall` | 安全移除插件并还原环境（保留备份与历史统计） |

> *注：Linux / macOS 用户请使用 `python3`。*

---

## 💻 多端支持

### 1. Antigravity IDE 独立版
提供专属的 VSIX 插件扩展，适用于 Antigravity Standalone IDE：
- 从 [最新发布页](https://github.com/moumouye/antigrative-dashboard/releases/latest) 获取 VSIX 或通过 IDE 扩展面板直接安装。
- 详情请查阅 [IDE 安装与调试说明](ide/README.md)。

### 2. Antigravity CLI 命令行终端
在终端中为 `agy` 提供紧凑的状态栏状态展示（tok/s、缓存命中率、多模型额度色块提醒）：
```bash
python manage.py install-cli   # 安装 CLI 状态栏适配器
```
![Antigravity CLI 状态栏预览](docs/assets/cli-conversation-zh.png?v=0.8.4-cli-1)
- 详情请查阅 [CLI 配置与使用文档](docs/CLI.md)。

---

## ❓ 常见问题

<details>
<summary><strong>Q: 安装后没有看到监控条怎么办？</strong></summary>

1. 确认已**完全退出并重启** Antigravity 客户端（部分系统需要彻底退出托盘后台）。
2. 在终端运行 `python manage.py status` 检查安装状态。
3. 打开任一已有对话或新建对话，监控条将在首次加载后挂载在模型选择下拉菜单旁。
</details>

<details>
<summary><strong>Q: 插件会修改 Antigravity 的核心文件吗？</strong></summary>

不会。默认使用标准 Sidecar 机制，通过本地渲染调试通道安全注入前端控件，**不会修改客户端的 `resources/app.asar` 归档**。
</details>

<details>
<summary><strong>Q: 客户端更新后需要重新安装吗？</strong></summary>

不需要。插件安装在用户主目录下的插件配置区，宿主客户端更新后会自动重新连接，历史统计与语言偏好均会完整保留。
</details>

---

## 📄 开源许可

本项目基于 [MIT License](LICENSE) 开源发布。
由 [moumouye/antigrative-dashboard](https://github.com/moumouye/antigrative-dashboard) 维护并持续迭代。
