# IDE 适配层开发规范与 AI 约束 (ide/AGENTS.md)

本目录承载针对 Google Antigravity 自带 IDE（基于 VS Code 构建）的 VSIX 插件适配器。

---

## 1. 模块职责与边界 (Module Scope)

* **核心职责**：通过 VS Code Extension API 探测语言服务器与渲染调试端口，将统一监控看板挂载至 IDE 底部状态栏与对话辅助面板；
* **打包交付物**：`dist/antigrative-dashboard-ide-*.vsix`；
* **所属范围**：`ide/main.mjs`, `ide/extension.cjs`, `ide/host.cjs`, `ide/surface.cjs`, `ide/package.py`, `ide/manage.py`。

---

## 2. 模块不可逾越的物理红线 (Non-negotiable Invariants)

1. **VS Code 扩展机制隔离**：严格通过 Webview 隔离沙箱与 Extension API 进行通信，严禁直接通过 DOM 遍历篡改宿主 IDE 的核心界面；
2. **打包清单绝对确定性**：新增的任何源文件必须显式在 `ide/package.py` 的 `MODULES` 白名单数组中登记，严禁隐式打包；
3. **版本绝对一致性**：`ide/package.json` 中的 `version` 必须与根目录 `package.json` 及 `plugin.json` 保持 100% 同步；
4. **统一看板接入**：视图工厂注入必须统一使用 `compat/usage-ui.cjs`，严禁在 IDE 内部另立第二套独立看板实现。

---

## 3. 关联领域规范 (Domain Specification)

修改本目录任何代码时，必须同步核验并对齐以下领域规范：
* [`ide/README.md`](README.md)：IDE 插件安装、升级、独立用户数据隔离与挂载流程；
* [`COMPATIBILITY.md`](../COMPATIBILITY.md) 第 3 节：IDE 扩展挂载规范与 `--remote-debugging-port` 参数要求。

---

## 4. 局部唯一验证门禁 (Verification Gate)

```bash
node --test ide/tests/*.test.mjs && python ide/package.py
```
断言 IDE 单元测试通过，且 VSIX 打包成功、SHA256 校验生成完整。
