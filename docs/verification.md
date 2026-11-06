# ④ 质量验收门禁与演进标准 (Verification Gate & Invariant Standards)

本文档定义系统交付前的硬性测试门禁、四大物理不变量断言规范与反向防倒退演进机制。
任何代码提交或发布前，**必须本地运行并全绿通过自动化门禁**，退出码严格为 `0`。

---

## 1. 唯一指定测试入口与当前基线 (Execution Command)

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

## 2. 实用主义测试分层裁决 (Testing Pragmatic Economics)

本仓库拒绝形式主义的脆弱自动化，按照代码变动的架构层级实施分层裁决：

| 变更类别 / 架构层级 | 验证形态 | 侧重点与断言目标 | 验证命令 |
| :--- | :--- | :--- | :--- |
| **账本 / 算法 / 离线计费** | 单元测试 (Unit) | 边界值计算、货币换算、Token 统计正确性 | `npm test` (过滤 `sidecars/panel/tests/`) |
| **视图注入 / 源码解析** | CDP 无头走查 (Live CDP) | 验证真实 Webview 全局工厂注入、无控制台报错 | `node tools/check-usage-ui-cdp.mjs` |
| **引导安装 / 更新生命周期** | 生命周期测试 (Lifecycle) | 跨平台路径解析、解包还原、备份幂等性 | `python3 -m unittest discover -s tests` |
| **版本发布 / 打包分发** | 资产完整性 (Packaging) | 白名单文件齐全度、发布模式参数适配 | `python manage.py package` |

---

## 3. 四大核心物理不变量断言 (The 4 Quality Invariants)

高质量测试验证的是**系统在任何环境扰动下依然成立的物理不变量**：

### ① 运行态真实保真 (Runtime Fidelity)
* **Webview 原生解析保真**：通过真实浏览器上下文加载被注入的 CJS 源码字符串，断言 Shadow DOM 正常挂载，页面无未捕获异常（`pageErrors` 为空）；
* **宿主零侵入保真**：安装器与挂载器严禁改动宿主 `app.asar` 文件，保证物理文件的哈希未被破坏。

### ② 时序稳态与抗回弹 (Temporal Stability & Anti-Rebound)
* **设备级统一账本稳态**：多账号物理路径统一解析至同一设备级目录，避免因账号切换导致用量重算或数据归零；
* **异步 Worker 写入稳态**：账本采用异步单向追加写入（JSONL），UI 线程不产生锁等待或重入颠簸。

### ③ 容灾与破坏性韧性 (Chaos & Disruption Resilience)
* **视图加载容灾**：当首选的 `usage-ui.local.cjs` 文件物理缺失时，`usage-view.mjs` 必须平滑降级回退至 `usage-ui.cjs`，严禁宿主白屏崩溃；
* **安装下载容灾**：在线安装器拉取 GitHub Release 资产失败（如纯文本发布无资产时），必须自动降级拉取 `main.zip` 分支源码包完成安装。

### ④ 避坑活体防倒退锁 (Anti-Regression Living Locks)

每个写入 [`docs/anti-patterns.md`](anti-patterns.md) 的避坑项，均有可执行的自动化反向断言阻断：

| 关联避坑项 | 物理断言点 (Invariant Assertion) | 检验机制与用例位置 |
| :--- | :--- | :--- |
| `AP-001` (TS 迁移陷阱) | 运行时源文件维持原生 `.mjs` / `.cjs`，无需编译步骤 | 打包白名单与源码加载器直读检验 |
| `AP-002` (改写基础视图) | `usage-ui.test.mjs` 校验 `usage-ui.local.cjs` 存在与自研看板结构 | 单元测试强制覆盖式断言 |
| `AP-003` (平行体系) | 所有新增测试必须能被 `npm test` 标准 glob 自动执行 | CI / 门禁入口唯一绑定 |
| `AP-005` (配置膨胀) | `package.json` 的 scripts 保持冻结，仅暴露唯一 `gate` 入口 | 代码走查与清单稳定性检查 |
| `AP-007` (单路径搬迁) | 所有视图消费者必须通过 `usage-view.mjs` 解析路径 | `check-usage-ui-cdp.mjs` 与跨模块断言 |
| `AP-008` (失效上游源) | 安装与更新网络链路指向 `moumouye/antigrative-dashboard` | `install.py` 与 `compat/update-worker.py` |
| `AP-009` (发布资产断言) | `--text-only` 模式下允许资产列表为空，不抛出 KeyError | `tools/publish-release.py` 纯文本发布逻辑 |

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

## 5. 动态重估机制 (Continuous Re-evaluation Protocol)

测试标准随系统架构演进而持续重估：
1. **缺陷逆向追肥**：任何生产逃逸缺陷修复后，必须在单测集中补齐反向断言，并在本文档第 3 节登记活体防倒退锁；
2. **断言降噪剪枝**：严禁在测试中使用固定等待时间（`setTimeout(..., 1000)`），统一采用物理事件监听或状态轮询，杜绝 Flaky Test。
