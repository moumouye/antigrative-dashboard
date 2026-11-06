# 本地服务与数据层开发规范与 AI 约束 (sidecars/panel/AGENTS.md)

本目录承载本地守护进程（Sidecar）、用量账本聚合服务、SQLite 异步持久化 Worker 与离线计费引擎。

---

## 1. 模块职责与边界 (Module Scope)

* **核心职责**：通过 Loopback IPC 桥接宿主请求、聚合会话级与设备级 Token 消耗、维护本地 SQLite 账本、离线测算 API 成本；
* **所属范围**：`sidecars/panel/main.mjs`, `sidecars/panel/usage.mjs`, `sidecars/panel/pricing.mjs`, `sidecars/panel/usage-disk-worker.mjs`, `sidecars/panel/store.mjs`, `sidecars/panel/metrics.mjs`。

---

## 2. 模块不可逾越的物理红线 (Non-negotiable Invariants)

1. **绝对本地回环隔离**：所有 HTTP / WebSocket 服务必须严格绑定 `127.0.0.1`，严禁监听 `0.0.0.0`，严禁暴露公网端口；
2. **零隐私外发与正文隔离**：仅读取和统计数值型元数据（Token 计数、时长、状态、模型名），严禁收集、存储或上传用户 Prompt、对话正文或认证密钥；
3. **离线静态计费**：价格表内置于 `pricing.mjs`，成本估算纯本地完成，严禁发起外部汇率或价格网络请求；
4. **内存与资源有界预算**：守护进程常驻内存严格控制在 4MB 预算以内；面对超长会话流式写入，必须交由 `usage-disk-worker.mjs` 在后台异步完成，严禁阻塞前台 UI 轮询。

---

## 3. 关联领域规范 (Domain Specification)

修改本目录任何代码时，必须强制同步核验并对齐以下核心领域规范：
* **Token 会计口径与子代理树状聚合** ➜ [`docs/USAGE.md`](../../docs/USAGE.md)
* **TPS 速率算法模型与 TTFT 剥离** ➜ [`docs/TPS.md`](../../docs/TPS.md)
* **模型上下文窗口与容量预警** ➜ [`docs/CONTEXT_LIMITS.md`](../../docs/CONTEXT_LIMITS.md)
* **超长会话异步流式分块协议** ➜ [`docs/LONG_CONVERSATIONS.md`](../../docs/LONG_CONVERSATIONS.md)
* **跨平台容灾与进程自愈状态机** ➜ [`docs/ROBUSTNESS.md`](../../docs/ROBUSTNESS.md)
* **应用更新与 NTFS 事务隔离** ➜ [`docs/UPDATES.md`](../../docs/UPDATES.md)

---

## 4. 局部唯一验证门禁 (Verification Gate)

```bash
node --test sidecars/panel/tests/*.test.mjs
```
断言账本聚合、子代理扣除、超长会话切片与价格测算全量通过。
