# 本地 Token 账本与用量核算规范 (Local Token Usage Spec)

本文档定义 Antigravity Pulse（Desktop 与 IDE）的本地 Token 账本核算口径、子代理递归聚合模型、配额优先级矩阵与内存安全预算。
核心实现位于 `sidecars/panel/usage.mjs`、`sidecars/panel/task-usage.mjs` 与 `sidecars/panel/delegation.mjs`。

---

## 1. 业务目标与账本不变量 (Context & Invariants)

* **领域核心目标**：提供设备级、高精度、离线自闭环的 Token 用量账本与成本估算，支持多层子代理（Boost / Teamwork）递归核算；
* **物理与代数不变量 (Invariants)**：
  1. **设备级账本单例统一 (Unified Device Scope)**：同一物理设备上所有登录账号共享一个物理账本数据库，作用域哈希固化为 `UNIFIED_SCOPE = sha256("antigravity:local:unified:usage")`；
  2. **绝对零凭据与零正文持久化**：请求 ID 在内存中立即进行 SHA-256 哈希脱敏，持久化记录仅包含数值与时间戳，严禁将 Prompt 词、响应文本写入磁盘；
  3. **非负单调性**：所有 Token 计数器必须为非负安全整数（$\ge 0$ 且 $\le \text{Number.MAX_SAFE_INTEGER}$）。

---

## 2. Token 代数计算口径与缓存命中率 (Mathematical Grounding)

### 2.1 基础 Token 四维正交模型

每次请求归一化提取四个正交维度：
* $T_{\text{uncached}}$：未命中缓存的输入 Token（Uncached Input）；
* $T_{\text{read}}$：从缓存读取的输入 Token（Cache Read）；
* $T_{\text{write}}$：写入缓存的输入 Token（Cache Write）；
* $T_{\text{out}}$：模型生成的输出 Token（Output Tokens）。

输入总量与全局总 Token 代数模型：

$$\begin{aligned}
T_{\text{in}} &= T_{\text{uncached}} + T_{\text{read}} + T_{\text{write}} \\
T_{\text{total}} &= T_{\text{in}} + T_{\text{out}} = T_{\text{uncached}} + T_{\text{read}} + T_{\text{write}} + T_{\text{out}}
\end{aligned}$$

### 2.2 缓存命中率代数公式 (Cache Hit Ratio)

缓存命中率定义为缓存读取量占输入总量的比例：

$$\text{Cache Hit Ratio} = \begin{cases} \dfrac{T_{\text{read}}}{T_{\text{in}}}, & T_{\text{in}} > 0 \\ 0, & T_{\text{in}} = 0 \end{cases}$$

### 2.3 子代理递归聚合代数模型 (Delegated Tasks / Subagents)

在 `/boost`、`/teamwork` 或子代理派生调用场景下，主会话的总消耗为根会话本体与所有可达子代节点的递归代数和：

$$T_{\text{conversation}} = T_{\text{root}} + \sum_{k \in \text{descendants}} T_k$$

其中可达子代理节点集合 $\mathcal{D}$ 必须通过权威宿主元数据字段识别，**严禁通过对话标题、Prompt 内容或工作区路径反推派生关系**：

$$\mathcal{D} = \left\{ c \;\middle|\; c \in \text{invokeSubagent.conversationId} \;\lor\; \text{metadata.parentConversationId} = \text{root} \;\lor\; \text{metadata.rootConversationId} = \text{root} \right\}$$

---

## 3. 配额窗口优先级矩阵 (Quota Window Priority Matrix)

宿主通过 `RetrieveUserQuotaSummary` 接口返回多组配额。系统严格依照以下状态转移与优先级矩阵进行渲染，严禁虚构时间窗口：

| 配额分组响应 | 权威判定规则 (Guard Condition) | 归一化处置动作 (Action) | 呈现策略 |
| :--- | :--- | :--- | :--- |
| **独立 Argon 桶**<br>`gemini-argon-wtu-weekly` | 响应中存在该专属 Bucket | 提取 `remainingFraction` 与 `resetTime`；具有**最高权威优先级** | 作为独立周度配额单独展示（即使余额为 0） |
| **通用 Gemini 桶**<br>`gemini` | 响应中仅存在通用组，无独立 Argon | Argon 共享使用该通用配额组 | 不伪造独立 Argon 配额，沿用通用配额 |
| **空值或缺失字段** | `remainingFraction` 缺省、null 或 NaN | 标记为 `Unknown` | 界面显示 `—`，严禁假设为 100% 或推算固定时限 |
| **确切零余额** | `remainingFraction === 0` | 保持 `0%` | 精确显示 0%，进入重置倒计时 |

---

## 4. 物理资源预算与时区边界 (Budgets & Boundaries)

| 物理控制项 | 硬性配额限制 | 超限保护机制 |
| :--- | :--- | :--- |
| **单文件读取上限** | $\le 8\text{ MiB}$ (`BACKFILL_BYTES`) | 游标按 64KB 分块读取，超出立即抛出 `USAGE_READ_BUDGET` 阻断 |
| **内存 Checkpoint 缓存** | $\le 4096$ 条目 (`BACKFILL_ENTRIES`) | LRU 淘汰机制，优先保留 `retry` 状态与活跃事务，settled 条目超限淘汰 |
| **日历日切分时区** | `Asia/Shanghai` (UTC+8) | 统一使用 `dateKey(time, 'Asia/Shanghai')` 切分，严禁使用本地宿主时区漂移 |
| **汇率离线离散表** | 纯静态存储于 `pricing.mjs` | 离线计算，严禁在渲染和统计主链路上发起实时网络汇率请求 |

---

## 5. 机械化断言与测试防线 (Verification Contract)

* **关联自动化测试套件**：
  - [`sidecars/panel/tests/usage.test.mjs`](file:///Users/yemou/Documents/extentions/antigrative-dashboard/sidecars/panel/tests/usage.test.mjs)
  - [`sidecars/panel/tests/task-usage.test.mjs`](file:///Users/yemou/Documents/extentions/antigrative-dashboard/sidecars/panel/tests/task-usage.test.mjs)
  - [`sidecars/panel/tests/delegated-usage.test.mjs`](file:///Users/yemou/Documents/extentions/antigrative-dashboard/sidecars/panel/tests/delegated-usage.test.mjs)
* **核心活体防倒退反向断言**：
  1. `subagent tokens are recursively aggregated into root conversation summary`（子代理 Token 严格递归汇总至主会话）；
  2. `cache hit ratio handles zero inputTokens denominator without NaN/Infinity`（零输入分母平滑返回 0，无数值溢出）；
  3. `argon weekly quota strictly overrides shared group when present`（独立 Argon 周配额存在时绝对优先）；
  4. `readBounded aborts with error when file exceeds 8MB limit`（超 8MB 账本文件物理阻断防爆内存）。
