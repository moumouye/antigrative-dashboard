# ④ 质量验收门禁与演进标准 (Verification Gate & Invariant Standards)

本文档定义系统交付前的自动化门禁、物理不变量断言规范与防倒退演进机制。
任何代码提交或版本发布前，**必须本地运行并全绿通过自动化门禁**，退出码严格为 `0`。

---

## 1. 门禁执行入口与基线 (Execution Command & Baseline)

```bash
node tools/local-gate.mjs
```

### 门禁执行基线
基线环境：macOS 26.5 / Node.js 26.13.0 / Python 3.11。零第三方依赖全量耗时约 34 秒。

| 门禁阶段 | 底层命令 | 断言目标 | 典型耗时 |
| :--- | :--- | :--- | ---: |
| **[1/3] Node 单元测试** | `npm test` | 491+ 项断言：账本聚合、定价估算、数据结构 | ≈22s |
| **[2/3] Python 生命周期** | `python3 -m unittest discover -s tests` | 95 项断言：安装引导、目录解析、打包校验 | ≈5s |
| **[3/3] 用量看板真实 CDP** | `node tools/check-usage-ui-cdp.mjs` | 直连系统 Chrome CDP 端口，端到端检验 Shadow DOM | ≈5s |
| **汇总判定** | `node tools/local-gate.mjs` | **3/3 PASS，退出码严格为 0** | ≈34s |

---

## 2. 测试分层矩阵 (Testing Matrix)

代码变动依据架构层级执行针对性验证：

| 变更类别 / 架构层级 | 验证形态 | 侧重点与断言目标 | 验证命令 |
| :--- | :--- | :--- | :--- |
| **账本 / 算法 / 离线计费** | 单元测试 (Unit) | 边界值计算、货币换算、Token 统计正确性 | `npm test` |
| **视图注入 / 源码解析** | CDP 无头走查 (Live CDP) | 验证真实 Webview 全局工厂注入、无控制台报错 | `node tools/check-usage-ui-cdp.mjs` |
| **引导安装 / 更新生命周期** | 生命周期测试 (Lifecycle) | 跨平台路径解析、解包还原、备份幂等性 | `python3 -m unittest discover -s tests` |
| **版本发布 / 打包分发** | 资产完整性 (Packaging) | 白名单文件齐全度、发布模式参数适配 | `python manage.py package` |

---

## 3. 核心物理不变量断言 (Quality Invariants)

测试套件重点验证系统在扰动下的关键不变量：

### ① 运行态真实保真 (Runtime Fidelity)
* **Webview 原生解析保真**：通过真实浏览器上下文加载被注入的 CJS 源码字符串，断言 Shadow DOM 正常挂载，页面无未捕获异常（`pageErrors` 为空）；
* **宿主零侵入保真**：安装器与挂载器严禁改动宿主 `app.asar` 文件，保证物理文件的哈希未被破坏。

### ② 时序稳态与抗回弹 (Temporal Stability & Anti-Rebound)
* **设备级统一账本稳态**：多账号物理路径统一解析至同一设备级目录，避免因账号切换导致用量重算或数据归零；
* **异步 Worker 写入稳态**：账本采用异步单向追加写入（JSONL），UI 线程不产生锁等待或重入颠簸。

### ③ 容灾与破坏性韧性 (Chaos & Disruption Resilience)
* **视图加载收口**：视图加载唯一由 `usage-view.mjs` 解析收口至 `usage-ui.cjs`，所有端侧（App / IDE / CDP 测试）统一引用单一真理源；
* **安装下载容灾**：在线安装器拉取 GitHub Release 资产失败（如纯文本发布无资产时），必须自动降级拉取 `main.zip` 分支源码包完成安装。

### ④ 避坑活体防倒退锁 (Anti-Regression Living Locks)

每个写入 [`docs/anti-patterns.md`](anti-patterns.md) 的避坑项，均有可执行的自动化反向断言阻断：

| 关联避坑项 | 物理断言点 (Invariant Assertion) | 检验机制与用例位置 |
| :--- | :--- | :--- |
| `AP-001` (多注入管线未收口) | 所有视图消费者必须通过 `usage-view.mjs` 解析路径，支持缺失降级 | `check-usage-ui-cdp.mjs` 与路径解析测试 |
| `AP-002` (发布流水线强耦合附件) | `--text-only` 模式下允许资产列表为空，不抛出 KeyError 异常 | `tools/publish-release.py` 纯文本发布逻辑 |
| `AP-003` (远程地址单点瘫痪) | 安装脚本支持 Release 资产与分支源码归档（`main.zip`）双级容灾下载 | `install.py` 下载重试与容灾回退逻辑 |

---

## 4. 常见失败排查与自愈手册 (Self-Correction Guide)

若门禁执行失败，禁止盲目修改生产代码，参照下表排查根因：

1. **CDP 报错：`Chrome is not running or CDP port is closed`**
   * **物理根因**：系统未安装 Google Chrome / Chromium，或未开放远程调试端口；
   * **自愈方案**：确认本地存在系统 Chrome，门禁脚本会自动调起临时无头实例并分配独立调试端口。
2. **测试超时：`marker notification timeout`**
   * **物理根因**：多进程高并发压力下定时器抖动；
   * **自愈方案**：单独重跑对应单测 `node --test sidecars/panel/tests/xxx.test.mjs`，消除瞬时负载影响。
3. **打包校验失败：`Missing required file in distribution`**
   * **物理根因**：新增了核心源码文件，但未在打包白名单（`contracts.md` 第 5 节）登记；
   * **自愈方案**：同步更新 `ide/package.py` 或 `manage.py` 的白名单数组。

---

## 5. 质量演进与反向锁维护 (Quality Evolution)

1. **缺陷闭环**：任何已修复的 Bug 必须在自动化测试集中留下反向断言，并在本文档第 3 节登记活体防倒退锁，杜绝二次逃逸；
2. **确定性测试**：严禁在测试中使用固定等待时间（如 `setTimeout(..., 1000)`），统一采用物理事件监听或状态轮询，避免偶发性测试不稳定。
