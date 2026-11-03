# 边界

本文件回答唯一问题：**这处改动会让我以后每次跟上游合并时付出多少代价。**

## 分区判定

上游改动频次决定冲突成本。重算命令（每次上游发版后执行一次）：

```bash
git log upstream/main -60 --name-only --format='COMMIT' \
 | python3 -c "import sys,collections;c=collections.Counter(l.strip() for l in sys.stdin if l.strip() and l.strip()!='COMMIT');[print(f'{n:3d}  {f}') for f,n in c.most_common(30)]"
```

`churn` = 上游最近 60 个提交中触碰该文件的次数。

| 分区 | 阈值 | 含义 |
| :--- | :--- | :--- |
| 禁改区 | churn ≥ 10 | 每次上游发版都可能手解冲突，改一行付一次代价 |
| 覆盖区 | churn 1–9 | 可改，但本地触点必须压到最小行数 |
| 自建区 | churn 0 | 上游不存在的文件，冲突率恒为零 |

## 当前分区表

基线：2026-11-02，`upstream/main` @ `b1ad237`（v0.8.18）。

| 文件 | churn | 分区 | 本地当前触点 |
| :--- | ---: | :--- | :--- |
| `CHANGELOG.md` | 26 | 禁改 | 曾追加 11 行 → 改记 [`LOCAL_CHANGES.md`](LOCAL_CHANGES.md) |
| `README.md` / `README.zh-CN.md` | 26 | 禁改 | 2 行 |
| `GITHUB_RELEASE.md` | 24 | 禁改 | 无 |
| `package.json` | 20 | 禁改 | 3/1 行，仅版本号，见 [`contracts.md`](contracts.md) |
| `plugin.json` / `ide/package.json` | 17 | 禁改 | 各 1 行，仅版本号 |
| `compat/inline-widget.cjs` | 16 | 禁改 | 14/6 行（待迁出） |
| `COMPATIBILITY.md` | 14 | 禁改 | 无 |
| `docs/UPDATES.md` | 14 | 禁改 | 无 |
| `compat/i18n.cjs` | 13 | 禁改 | 无 |
| `ide/README.md` | 13 | 禁改 | 无 |
| `compat/usage-ui.cjs` | 10 | 禁改 | **0 行**（自研实现已迁出，见下行） |
| `sidecars/panel/usage.mjs` | 10 | 禁改 | 112/41 行（账本内核，需保留） |
| `sidecars/panel/app.js` | 12 | 禁改 | 无 |
| `ide/main.mjs` | 8 | 覆盖区 | 3 行；注入点入口，见 [`contracts.md`](contracts.md) |
| `sidecars/panel/main.mjs` | 10 | 禁改 | 1 行；App 注入点，改指解析器 |
| `tools/check-usage-ui.mjs` | 2 | 覆盖区 | 53 行 |
| `tools/check-cold-start-ui.mjs` | 2 | 覆盖区 | 1 行（视图路径） |
| `tools/check-teamwork-ui.mjs` | 0 | 覆盖区 | 1 行（视图路径） |
| `tools/check-collection-state-ui.mjs` | 1 | 覆盖区 | 1 行（视图路径） |
| `tools/check-widget-lifecycle.mjs` | 1 | 覆盖区 | 1 行（视图路径） |
| `tools/check-usage-performance.mjs` | 1 | 覆盖区 | 2 行（改用解析器） |
| `tools/check-sidebar-subagent-ui.mjs` | 1 | 覆盖区 | 6 行（改用解析器） |
| `tools/render-readme-assets.mjs` | 0 | 覆盖区 | 7 行（改用解析器） |
| `sidecars/panel/usage-disk-worker.mjs` | 1 | 覆盖区 | 26/5 行 |
| `sidecars/panel/pricing.mjs` | 0 | 自建 | 新增 277 行 |
| `compat/usage-ui.local.cjs` | 0 | 自建 | 新增 1102 行（自研用量视图） |
| `compat/usage-view.mjs` | 0 | 自建 | 视图路径唯一解析处，含回退 |
| `tools/check-usage-ui-cdp.mjs` | 0 | 自建 | 新增 149 行 |
| `tools/reload-live-ui.mjs` | 0 | 自建 | 新增 49 行 |
| `tools/local-gate.mjs` | 0 | 自建 | 门禁入口 |
| `docs/boundaries.md` 等小写文档 | 0 | 自建 | 本地真理库 |

`sidecars/panel/usage.mjs` 处于禁改区但有 112 行本地改动，这是本仓库既成事实。它承载统一账本内核，无迁出路径，只能接受每次上游触碰时手解。触碰该文件前先在 [`LOCAL_CHANGES.md`](LOCAL_CHANGES.md) 找到对应改动目的。

## 上游漂移边界

上游 2026-10-21 至 11-01 六天内发布 v0.8.10 至 v0.8.17 共八个版本。任何"一次改造到位"的结构性变更都会在下一次发版时失效。因此：

- 本地改动一律以**新增文件**为首选形态，修改上游文件为次选，重命名或重排目录为禁止形态；
- 上游更新走 `git fetch upstream` + 逐条 `cherry-pick`，不执行 `git merge upstream/main`；
- `upstream` 已设 `pushurl=no_push`，写入通道物理封死。

## 数据边界

上游已完整描述数据边界（账户凭据、会话正文、轨迹落盘、SDK 兼容目录），见 [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) 的「数据边界」一节。本节不复制其内容。

本地增量约束只有一条：新增的统计与定价能力（`pricing.mjs`）只读上游已提供的数值元数据，不落盘任何会话正文，不引入外部网络请求——价格表为本地静态数据。

## 硬禁区

- **JS 改 TS**：122 个 `.mjs` 全部重命名，冲突类型变为最难解的 rename/modify；且本仓库无构建链、打包白名单按文件名硬列举。类型收益走 `// @ts-check` + JSDoc，见 [`anti-patterns.md`](anti-patterns.md) AP-001。
- **目录重排**：`sidecars/`、`compat/`、`ide/`、`tools/`、`tests/` 的层次是上游测试 glob、打包白名单和 CI 的共同前提，移动任一路径会同时打断三处。
- **平行体系**：本地测试、门禁、文档不得另立第二套目录或第二份真相，见 AP-003。

## 复核触发条件

上游发版、`docs/DEVELOPMENT.md` 被改写、本地新增文件进入 `tools/` 或 `compat/` 时，重新执行本页判定命令并覆盖本表。
