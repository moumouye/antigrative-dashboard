# 本地变更流水

替代在上游 `CHANGELOG.md` 中追加条目的做法（理由见 [`anti-patterns.md`](anti-patterns.md) AP-004）。本文件只记录**相对 `upstream/main` 的增量**，上游自身的变更看 `CHANGELOG.md`。

## 2026-11-03 视图加载路径收口

| 范围 | 内容 | 提交 |
| :--- | :--- | :--- |
| 加载 | 新增 `compat/usage-view.mjs` 作为视图文件唯一解析处：本地文件存在即用，缺失回退上游基线 | 本批 |
| App | `sidecars/panel/main.mjs:43` 改走解析器。此前仍按名读 `compat/usage-ui.cjs`，重装后会加载已还原的上游简版 | 本批 |
| 门禁 | `check-usage-performance`、`check-sidebar-subagent-ui`、`render-readme-assets` 三处改走解析器，此前同样指向旧文件 | 本批 |
| 测试 | `entry-usage.test.mjs` 的模块桩补 `usage-view.mjs`，否则 VM 加载器拒绝未知导入 | 本批 |

## 2026-11-02 治理层

| 范围 | 内容 | 提交 |
| :--- | :--- | :--- |
| 文档 | 建立真理库 `docs/`（boundaries / contracts / anti-patterns / verification / LOCAL_CHANGES）与根索引 `ARCHITECTURE.md`、`AGENTS.md`，确立与上游文档的单向引用规则 | 本批 |
| 门禁 | 新增 `tools/local-gate.mjs` 作为本地门禁唯一入口，`package.json` 收敛为稳定入口，此后新增门禁不再触碰上游高频文件 | 本批 |
| 渲染 | 自研用量视图迁出 `compat/usage-ui.cjs`（1102 行）至新文件 `compat/usage-ui.local.cjs`，上游文件还原为原样 325 行；注入序列末尾追加覆盖项，本地触点从 1141 行降至 1 行 | 本批 |

## 2026-11-02 统一账本与用量视图

| 范围 | 内容 | 提交 |
| :--- | :--- | :--- |
| 账本 | 采用上游 v0.8.18 内核，把分账号物理目录收敛为设备级统一账本；旧目录合并后归档至 `.merged-<uuid>/`，不删除 | `65ac77f` |
| 测试 | 账本断言对齐设备级作用域 | `8ba0c08` |
| 门禁 | 新增 `tools/check-usage-ui-cdp.mjs`，零依赖驱动系统 Chrome 校验用量视图 | `2742ca7` |
| 视图 | 用量窗口收敛为双页签免滚动；表头静默；实时刷新保持 | `07b0c4f` `7a412c8` `34be25e` |
| 行为 | 完整行不再误标；打开窗口不再触发导入 | `ecf7a90` |
| 工具 | `tools/reload-live-ui.mjs` 经 CDP 热重载控件，免重启宿主 | `25f6ace` |
| 定价 | 新增 `sidecars/panel/pricing.mjs`，静态价格表 + 人民币成本估算，仅读数值元数据 | `65ac77f` |

## 2026-10-14 v0.8.7 增强基线

| 范围 | 内容 |
| :--- | :--- |
| 图表 | 年度日历改为 24 小时日内活动图 + 日期切换胶囊；Y 轴刻度校准 |
| 视图 | 默认进入活动总览页；周期锚点隔离与导航钳制，防月份漂移 |
| 筛选 | token 组件筛选、并行布局、状态栏自动展开 |
| 更新 | GitHub 发布自动检测与一键交互式更新 |
| 定价 | 实时成本估算，用量表列重构 |
| 修复 | 用量视图锚定当前日期，防同步死锁 |

该批次共 10 个提交，落在 `main` 与 `feat/hourly-activity-and-component-filter`，是 `feat/v0.8.18-unified-usage` 的历史前身。上游 v0.8.8 之后自行实现了 24 小时图与统一账本，两条演进线在此汇合。
