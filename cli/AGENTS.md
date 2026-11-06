# CLI 模块开发规范与 AI 约束 (cli/AGENTS.md)

本目录为 Antigravity Pulse 面向命令行终端的轻量 statusLine 适配器。

---

## 1. 模块职责与边界 (Module Scope)

* **核心输入**：从 Antigravity CLI 进程的 `stdin` 读取结构化 JSON 状态流；
* **核心输出**：向 `stdout` 输出单行/多行经过紧凑排版与 ANSI 颜色编码的终端文本；
* **所属范围**：`cli/statusline.mjs`, `cli/metrics.mjs`, `cli/render.mjs`, `cli/lifecycle.py`。

---

## 2. 模块不可逾越的物理红线 (Non-negotiable Invariants)

1. **零 DOM / 零 Webview 依赖**：纯 Node.js CLI 标准输入输出流处理，严禁引入任何浏览器全局对象（`window`, `document`）或 Electron 依赖；
2. **极限执行性能**：进程单次生命周期必须在 50ms 内完成，严禁进行复杂网络轮询或大文件扫描；
3. **终端跨平台兼容**：严格遵循 ANSI 转义序列标准，Windows 下支持 PowerShell 与 cmd 输出，支持 `NO_COLOR` 与 `TERM=dumb` 无色彩模式；
4. **单向数据消费**：仅展示配额与速率元数据，严禁读取、存储或暴露会话正文。

---

## 3. 关联领域规范 (Domain Specification)

修改本目录任何代码时，必须同步核验并对齐以下领域规范：
* [`docs/CLI.md`](../docs/CLI.md)：CLI 状态行管道协议、Argon 额度解析与 ANSI 格式化标准。

---

## 4. 局部唯一验证门禁 (Verification Gate)

```bash
node --test cli/tests/*.test.mjs
```
所有用例退出码必须为 0，终端宽度自适应测试必须全绿。
