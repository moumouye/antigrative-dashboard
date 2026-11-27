# Antigravity 仪表盘 v0.8.21 发版说明

### 核心更新与说明

- **适配新版 Antigravity 默认关闭 CDP 的机制（零侵入）**：新增跨插件共享引导模块 `compat/cdp_bootstrap.py`，在不修改官方应用签名与 `resources/app.asar` 的前提下，自动打通本地回环 CDP 挂载链路（`--remote-debugging-port=0 --remote-debugging-address=127.0.0.1`）。
- **macOS 自动引导与启动器**：安装时自动配置登录自启项（`com.moumouye.antigravity-cdp`）并现场编译 `/Applications/Antigravity Launcher.app`，内置当前会话防误杀守卫。完全退出客户端后请通过「Antigravity Launcher」重新打开（建议替换 Dock 原版图标）。
- **Windows 快捷方式自动注入与无损还原**：自动为桌面、开始菜单与任务栏中的 Antigravity 快捷方式追加调试参数并启用登录自检守护；若之前固定在任务栏的旧图标未生效，取消固定后从桌面重新固定一次即可。
- **多插件共享与命令增强**：支持与 `antigravity-font-settings`、`antigravity-timeline` 共用同一份引导底座与引用计数卸载；新增 `python manage.py setup-cdp` 一键修复命令与 `status` 中的 `cdpBootstrap` 状态展示，并兼容 Windows 非 UTF-8（`cp1252`）控制台输出。

---

*详细更新历史请参阅 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md) 与 [CHANGELOG.md](CHANGELOG.md)。*
