<div align="center">

<img src="docs/assets/hero.png?v=0.8.0" width="100%" alt="Antigrative Dashboard: Real-time inline metrics next to the input">

# Antigrative Dashboard

**Native Performance & Quota Dashboard for Google Antigravity**<br>
Monitor real-time token throughput (tok/s), cache hit rate, context occupancy, and account quotas directly in the model selector row.

[![Version 0.8.19](https://img.shields.io/badge/version-0.8.19-91adff?style=flat-square&labelColor=252936)](CHANGELOG.md)
[![Platforms](https://img.shields.io/badge/host-Windows%20%7C%20Linux%20%7C%20macOS-83d8b9?style=flat-square&labelColor=252936)](COMPATIBILITY.md)
[![Antigravity 2.21.1 / 2.22.0](https://img.shields.io/badge/Antigravity-2.21.1%20%2F%202.22.0-c5a0ff?style=flat-square&labelColor=252936)](COMPATIBILITY.md)
[![MIT](https://img.shields.io/badge/license-MIT-d4d9e6?style=flat-square&labelColor=252936)](LICENSE)

[⚡️ Quick Install](#-quick-install) · [✨ Features](#-features) · [🛠 Management](#-management) · [💻 Multi-Host](#-multi-host-support) · [FAQ](#-faq) · [中文文档](README.md)

</div>

---

## ⚡️ Quick Install

Zero third-party dependencies (requires Python 3.10+). Run one command in your terminal to automatically install and enable:

### macOS / Linux
```bash
curl -fsSL https://raw.githubusercontent.com/moumouye/antigrative-dashboard/main/install.py | python3
```

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/moumouye/antigrative-dashboard/main/install.ps1 | iex
```

> **After Installation**: Fully quit and reopen the Antigravity application. Open any conversation, and the status bar will appear right beside the model selector.

<details>
<summary><strong>Prefer manual cloning or offline setup? Click to expand</strong></summary>

```bash
git clone https://github.com/moumouye/antigrative-dashboard.git
cd antigrative-dashboard
python manage.py install   # Use python3 on Linux / macOS
```
</details>

---

## 📸 Preview

<table>
<tr><th width="50%">Generation Speed & Token Cache</th><th width="50%">Context & Multi-Model Quotas</th></tr>
<tr>
<td width="50%" valign="top">
  <img src="docs/assets/speed.png?v=0.8.0" width="100%" alt="Speed detail card"><br>
  <img src="docs/assets/widget.png?v=0.8.0" width="100%" alt="Token usage and cache detail card">
</td>
<td width="50%" valign="top">
  <img src="docs/assets/context.png?v=0.8.0" width="100%" alt="Context and quota detail card">
</td>
</tr>
</table>

<table>
<tr><th width="50%">Daily / Weekly Activity Heatmap</th><th width="50%">Model Breakdown & Analytics</th></tr>
<tr>
<td width="50%">
  <img src="docs/assets/usage-overview.png?v=0.8.0" width="100%" alt="Token activity overview heatmap">
</td>
<td width="50%">
  <img src="docs/assets/usage-details.png?v=0.8.0" width="100%" alt="Model usage breakdown chart">
</td>
</tr>
</table>

---

## ✨ Features

- **🚀 Real-Time Performance**: Accurately tracks weighted tokens per second (tok/s), current request speed, time-to-first-token (TTFT), and tool invocation duration.
- **📊 Precise Quota Tracking**: Distinguishes 5-hour and weekly quotas across Gemini and Claude/GPT models; uniquely identifies dedicated Gemini 4 Argon quotas with live reset countdown timers.
- **🎯 Deep Cache Transparency**: DSH-style display of uncached inputs, cache reads, and output tokens, providing clear visibility into prompt cache hit rates.
- **📈 Built-In Interactive Dashboard**: One click to open an integrated analytics window with day/week/month filters, model-level aggregations, and 24-hour activity breakdowns.
- **🎨 Adaptive User Experience**:
  - **Themes & Languages**: Seamlessly adapts to Antigravity light/dark themes; supports English, Simplified Chinese, and Traditional Chinese with saved preferences.
  - **Compact Mode**: Automatically condenses into clean clickable icons on narrow windows without obstructing inputs or conversation controls.
- **🔒 Private & Local**: Communicates exclusively via localhost/loopback interfaces and stores metrics locally; never sends prompts or tokens to external services.

---

## 🛠 Management

Run management commands from your dashboard source folder (default: `~/.gemini/antigrative-dashboard`):

| Action | Command | Description |
| :--- | :--- | :--- |
| **Inspect Status** | `python manage.py status` | Check installation path, integration mode, and connection health |
| **Disable** | `python manage.py disable` | Temporarily disable the widget on next poll |
| **Enable** | `python manage.py enable` | Re-enable the widget in conversation views |
| **Uninstall** | `python manage.py uninstall` | Safely remove the plugin and restore configuration (backups preserved) |

> *Note: Use `python3` on Linux / macOS.*

---

## 💻 Multi-Host Support

### 1. Antigravity IDE (Standalone)
Provides a dedicated VSIX extension tailored for Antigravity Standalone IDE:
- Install directly from the IDE Extensions menu using **Install from VSIX…** via the [latest release](https://github.com/moumouye/antigrative-dashboard/releases/latest).
- See the [IDE Installation & Diagnostics Guide](ide/README.md) for details.

### 2. Antigravity CLI Status Line
Adds a compact terminal status line for the official `agy` CLI (tok/s, cache hit %, quota color bars):
```bash
python manage.py install-cli   # Install the CLI adapter
```
![Antigravity CLI Status Line Preview](docs/assets/cli-conversation.png?v=0.8.4-cli-1)
- See the [CLI Configuration & Usage Guide](docs/CLI.md) for details.

---

## ❓ FAQ

<details>
<summary><strong>Q: The status bar does not appear after installation?</strong></summary>

1. Ensure Antigravity is **fully quit and reopened** (verify no lingering tray processes).
2. Run `python manage.py status` in your terminal to check adapter health.
3. Open an existing or new conversation; the widget mounts right beside the model selector.
</details>

<details>
<summary><strong>Q: Does this modify Antigravity core files?</strong></summary>

No. The plugin uses a standard Sidecar attachment via the local renderer debugging endpoint. **It does not modify the `resources/app.asar` archive**.
</details>

<details>
<summary><strong>Q: Do I need to reinstall after an Antigravity app update?</strong></summary>

No. The plugin files reside safely in your user configuration directory. The runtime reconnects automatically after application updates, preserving all statistics and settings.
</details>

---

## 📄 License

Distributed under the [MIT License](LICENSE).<br>
Maintained and actively developed by [moumouye/antigrative-dashboard](https://github.com/moumouye/antigrative-dashboard).
