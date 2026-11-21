# 生成速率与耗时模型技术规范 (TPS & Timing Quality Spec)

本文档定义 Antigravity Pulse（Desktop 与 IDE）共用的 Token 生成速率（TPS）计算模型、耗时测量准则与离群值隔离法则。
核心实现位于 `sidecars/panel/metrics.mjs` 与 `sidecars/panel/rate-quality.mjs`。

---

## 1. 业务目标与代数不变量 (Context & Invariants)

* **领域核心目标**：提供可信、无缓冲污染的真实硬件级实时 Token 生成速率（Tokens Per Second）度量；
* **物理与代数不变量 (Invariants)**：
  1. **首字时延物理剥离**：首字时间（TTFT, Time To First Token）严格独立测量，$\Delta t_{\text{TTFT}} \notin \Delta t_{\text{stream}}$，绝对不可计入 TPS 流式生成时间分母；
  2. **全量吞吐对齐**：流式生成全周期（包含思考输出与正文输出）均占用模型生成计算带宽，TPS 统计分子采用全量输出 Token，分母采用对应流式总时长；
  3. **零合成时延与零速度硬上限**：严禁人为硬编码最大速率上限（如 200 tps），严禁伪造时延常数；
  4. **数据隐私物理隔离**：持久化速率记录时，仅存储数值聚合指标与枚举错误码，严禁存储任何对话 Prompt、响应正文或原始轨迹片段。

---

## 2. 数学计算模型与滤波法则 (Mathematical Grounding)

### 2.1 流式生成速率基础公式 (Base TPS Formula)

对于单次或多次合并请求，流式生成速率定义为全量输出 Token 数量与流式持续时间的商：

$$\text{TPS} = \begin{cases} \dfrac{\sum T_{\text{out}}}{\Delta t_{\text{stream}}}, & \Delta t_{\text{stream}} > 0 \\ \text{null}, & \Delta t_{\text{stream}} \le 0 \end{cases}$$

#### 变量与物理含义定义：
1. **分子（全量输出 Token，Total Output Tokens）**：
   $$T_{\text{out}} = \begin{cases} \text{usage.outputTokens}, & \text{usage.outputTokens} \ne \text{null} \\ T_{\text{response}} + T_{\text{thinking}}, & \text{存在细分字段但缺省总量的场景} \end{cases}$$
   *模型在流式生成中，自 TTFT 结束即全速吐字（无论是思考阶段还是正文阶段），两者共享底层计算与输出吞吐带宽。因此分子严格采用全量生成 Token。同时，系统在呈现层通过独立计数器保留正文与思考 Token 的细分展示。*
2. **分母（流式总耗时，Streaming Duration）**：
   $$\Delta t_{\text{stream}} = \text{seconds}(\text{chat.streamingDuration})$$
   *覆盖模型自首字到达（TTFT）后开始流式吐字直至完整结束的持续时间。首字时延严格独立测量，不计入流式生成时间分母。*
3. **会话级加权 TPS (Session Weighted TPS)**：
   $$\text{TPS}_{\text{session}} = \dfrac{\sum_{i \in \text{Accepted}} T_{\text{out}, i}}{\sum_{i \in \text{Accepted}} \Delta t_{\text{stream}, i}}$$
   *多请求合并与会话级平均速率统一采用总时长加权算法，防止极短时小请求拉偏会话整体速率水平。*

当存在多个并发流或重叠时间片时，采用一维时间区间并集测度计算实际流式总耗时：

$$\Delta t_{\text{stream}} = \frac{1}{1000} \cdot \mu\left(\bigcup_{k} [t_{k,\text{start}}, t_{k,\text{end}}]\right)$$

### 2.2 离群值基准池与 MAD 滤波 (Median & MAD Outlier Filter)

为防止短时缓冲区冲刷（Buffer Flush）导致虚假极高速率，系统维护同模型画像（Same Model Profile: 模型名 + 供应商 + Token 统计口径）基准池：

1. **有效基准样本池条件**：
   $$\mathcal{P}_{\text{base}} = \left\{ \text{tps}_i \;\middle|\; \text{reasons}_i = \emptyset \;\land\; \Delta t_i \ge 1.0\text{ s} \;\land\; \text{tps}_i > 0 \right\}$$
2. **中位数基准 ($\tilde{X}$)**：
   $$\tilde{X} = \text{median}(\mathcal{P}_{\text{base}})$$
3. **中位数绝对偏差 (MAD)**：
   $$\text{MAD} = \text{median}\left( \left\{ |\text{tps}_i - \tilde{X}| \;\middle|\; \text{tps}_i \in \mathcal{P}_{\text{base}} \right\} \right)$$
4. **动态隔离阈值上限 ($\text{Limit}_{\text{quarantine}}$)**（要求 $|\mathcal{P}_{\text{base}}| \ge 5$）：
   $$\text{Limit}_{\text{quarantine}} = \max\left( 8 \cdot \tilde{X}, \; \tilde{X} + 12 \cdot \text{MAD} \right)$$

### 2.3 异常样本判定与隔离守卫 (Quarantine Guard Conditions)

任何样本若命中以下守卫条件，立即标记为隔离异常（Unreliable），禁止进入有效速率呈现：

| 异常判定项 | 触发判定代数守卫条件 (Guard Assertion) | 记录原因码 (Reason Code) |
| :--- | :--- | :--- |
| **短样本离群冲刷** | $\Delta t < 1.0\text{ s} \;\land\; \text{TPS} > \text{Limit}_{\text{quarantine}} \;\land\; |\mathcal{P}_{\text{base}}| \ge 5$ | `short-outlier` |
| **工具调用缓冲疑似** | $0 < \Delta t < 1.0\text{ s} \;\land\; T_{\text{out}} > 0 \;\land\; \text{isToolOnly} \;\land\; \Delta t_{\text{TTFT}} \ge 2.0\text{ s} \;\land\; \dfrac{\Delta t_{\text{TTFT}}}{\Delta t} \ge 20$ | `short-tool-window` |
| **非有限速率数值** | $\neg\text{Number.isFinite}(\text{TPS}) \;\land\; \Delta t > 0 \;\land\; T_{\text{out}} \ne \text{null}$ | `nonfinite-rate` |
| **Token 作用域非法** | 上下文作用域不一致或响应标记冲突 | `token-scope` |
| **重复请求记录冲突** | 相同 Request ID 出现互斥数值记录 | `duplicate-scope` |
| **重试计费记录冲突** | 单次请求包含多条不同计费统计的 `retryInfos` | `retry-scope` |

> [!NOTE]
> **真实高生成率保护原则**：持续时长 $\Delta t \ge 1.0\text{ s}$ 的样本，即使其速率超过 $\text{Limit}_{\text{quarantine}}$，也**绝不**判定为 `short-outlier`（保留真实模型输出极速）。

---

## 3. 诊断代码与界面呈现矩阵 (Reason Codes & Display Matrix)

| 状态标识 (Status) | 判定守卫条件 | 界面显示文本 (UI Display) | 数据持久化与统计行为 |
| :--- | :--- | :--- | :--- |
| **`ok`** | `reasons.length == 0 && rateTokens !== null && duration > 0` | 正常数值 (例: `166.5 tok/s`) | 写入本地持久化统计快照 |
| **`unreliable`** | 命中任意 `RATE_REASONS` | **Timing uncertain / 计时异常** | 记录原因码；遮蔽速率；保留 Token/TTFT/Context |
| **`missing`** | `rateTokens === null \|\| duration <= 0` | 占位横线 (`—`) | 不计入速率聚合；保持未知状态 |

### 界面说明与细分呈现契约
* **速率说明注脚**：在指标卡片底部明确声明统计口径为 `统计方式：全量输出 Token ÷ 流式时长；会话 TPS 按总时长加权。`；
* **正文与思考细分呈现**：虽然 TPS 分子采用全量输出，但在数据结构与界面展示上，仍通过 `counts.responseOutput` 与 `counts.thinkingOutput` 分别保留正文 Token 与思考 Token 的独立统计（如 `正文与思考输出: 34,922 / 68,041 tok`）。

---

## 4. 物理存储与版本控制 (Persistence & Versioning)

1. **版本化快照控制（Versioned Snapshot Invariant）**：速率计算采用严格的版本标识（`RATE_VERSION = 2`）。若本地持久化快照版本与当前规范版本不一致，该历史快照标记为待重算状态，在重新读取完整会话轨迹时以全量输出口径全量重新计算；
2. **全覆盖替换契约**：全覆盖（Full Coverage）重算快照具有最高优先级，宿主部分退化或不完整的临时响应不得覆盖全覆盖历史；
3. **隐私物理隔离**：仅保存数值聚合结果（`tokens`, `ttft`, `duration`, `tps`）与不可变枚举错误码，严禁将 Prompt 词、用户数据持久化至本地数据库或 JSON 账本中。

---

## 5. 机械化断言与测试防线 (Verification Contract)

* **关联自动化测试套件**：
  - [`sidecars/panel/tests/rate-quality.test.mjs`](file:///Users/yemou/Documents/extentions/antigrative-dashboard/sidecars/panel/tests/rate-quality.test.mjs)
  - [`sidecars/panel/tests/metrics.test.mjs`](file:///Users/yemou/Documents/extentions/antigrative-dashboard/sidecars/panel/tests/metrics.test.mjs)
* **核心活体防倒退反向断言**：
  1. `single retryInfos item is not treated as a retry scope conflict`（单次重试信息不误判冲突）；
  2. `sustained high rate (>= 1s) is not quarantined by MAD filter`（持续高生成率绝对不受 MAD 误杀）；
  3. `tool-only short stream with high TTFT/stream ratio is strictly quarantined`（短流高比值工具调用强制隔离）；
  4. `different model profiles never pollute baseline median`（异构模型间基准池物理隔离）。
