# AGENTS.md

本项目为主维护源，负责 Antigravity Pulse（用量分析与监控仪表板）的全链路开发、测试与发版。

---

## 铁律 (Non-negotiable Rules)

1. **新增文件优先。** 改一处功能，先问能否用新文件实现；模块变更遵循架构分层。
2. **不重命名、不重排目录。** 文件路径同时被测试 glob、打包白名单、CI 引用，任一改名打断三处。
3. **不建平行体系。** 测试进标准 glob 目录，门禁进 `tools/check-*.mjs`，文档进 `docs/`。
4. **事实只有一个出处。** 系统架构与契约只写指针，不复制正文。
5. **发布规范化。** 发版走 `python manage.py package` 与 GitHub Actions Release 自动流水线，支持单脚本 `install.py` 一键安装。
6. **改动落地前跑门禁。** `node tools/local-gate.mjs`；涉及渲染、安装、打包时按 [`docs/verification.md`](docs/verification.md) 的矩阵加跑。

---

## 代码与领域规范强绑定映射 (Code-to-Doc Living Locks)

为杜绝文档腐化，凡改动以下源码核心逻辑，**必须在同一次提交中同步覆盖写对应的领域规范文档**，测试断言与文档必须保持 100% 数学一致性：

| 变更源码路径 | 核心业务领域 | 必须同步更新的规范文档 | 核心关注点 |
| :--- | :--- | :--- | :--- |
| `sidecars/panel/metrics.mjs` | 生成速率与耗时模型 | [`docs/TPS.md`](docs/TPS.md) | Median / MAD 过滤算法、Thinking 与 TTFT 剥离准则 |
| `sidecars/panel/usage.mjs` | Token 账本与子代理核算 | [`docs/USAGE.md`](docs/USAGE.md) | 设备级账本聚合、多层子代理扣除、Cache 命中率公式 |
| `sidecars/panel/pricing.mjs` | 离线计费与模型窗口 | [`docs/CONTEXT_LIMITS.md`](docs/CONTEXT_LIMITS.md) | Gemini 模型容量、输入预算与压缩预警阈值 |
| `sidecars/panel/usage-disk-worker.mjs` | 超长轨迹持久化 | [`docs/LONG_CONVERSATIONS.md`](docs/LONG_CONVERSATIONS.md) | 8MB 内存上限、SQLite 异步切片读写协议 |
| `sidecars/panel/updater.mjs` | 应用更新与容灾 | [`docs/UPDATES.md`](docs/UPDATES.md) | Windows NTFS Junction 兼容、事务锁与原子更新机制 |
| `cli/*.mjs` | 终端轻量展示 | [`docs/CLI.md`](docs/CLI.md) | 管道协议输入格式、Argon 额度解析与 ANSI 自适应宽度 |

---

## 动手前 (Before Coding)

```bash
node tools/local-gate.mjs --list        # 当前门禁计划
git status                              # 检查当前分支与未提交改动
```

查阅 `docs/boundaries.md` 确认改动是否触碰物理红线与模块职责。跨模块开发请遵循局部真理库：
* **CLI 模块**：查阅 [`cli/AGENTS.md`](cli/AGENTS.md)
* **IDE 扩展模块**：查阅 [`ide/AGENTS.md`](ide/AGENTS.md)
* **本地守护与数据模块**：查阅 [`sidecars/panel/AGENTS.md`](sidecars/panel/AGENTS.md)

---

## 收工前 (Before Commit)

```bash
node tools/local-gate.mjs               # 零依赖全量，约 30s
```

失败即停，修完再提交。修复缺陷时同步补反向断言，杜绝同类问题二次逃逸。

---

## 提交 (Atomic Commit)

```text
<type>(<scope>): <结果>

- **Why**: 改动动机或缺陷根因
- **How**: 核心实现方式
- **Caveats**: 放弃的备选方案、已知边界
```

`type` 取 `feat` `fix` `refactor` `test` `docs` `chore`。一次提交只做一件事，不 `git add -A`。标题行沿用仓库既有风格，不加 emoji 前缀。

---

## 两层文档导航 (Documentation Hub)

### 第一层：工程治理与物理红线 (Governance Layer)
* 系统总图谱：[`ARCHITECTURE.md`](ARCHITECTURE.md)
* 架构物理红线：[`docs/boundaries.md`](docs/boundaries.md)
* 接口与注入契约：[`docs/contracts.md`](docs/contracts.md)
* 避坑与暗知识：[`docs/anti-patterns.md`](docs/anti-patterns.md)
* 质量验收门禁：[`docs/verification.md`](docs/verification.md)
* 全版本演进流：[`CHANGELOG.md`](CHANGELOG.md)

### 第二层：核心领域协议与算法规范 (Domain Specifications)
* 速率算法规范：[`docs/TPS.md`](docs/TPS.md)
* Token核算口径：[`docs/USAGE.md`](docs/USAGE.md)
* 模型上下文模型：[`docs/CONTEXT_LIMITS.md`](docs/CONTEXT_LIMITS.md)
* 长会话切片协议：[`docs/LONG_CONVERSATIONS.md`](docs/LONG_CONVERSATIONS.md)
* CLI管道集成协议：[`docs/CLI.md`](docs/CLI.md)
* 容灾自愈状态机：[`docs/ROBUSTNESS.md`](docs/ROBUSTNESS.md)
* 应用更新与NTFS规范：[`docs/UPDATES.md`](docs/UPDATES.md)
