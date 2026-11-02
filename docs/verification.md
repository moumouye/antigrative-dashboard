# 门禁

上游的测试命令与故障矩阵由 [`docs/DEVELOPMENT.md`](DEVELOPMENT.md)、[`docs/ROBUSTNESS.md`](ROBUSTNESS.md) 定义，本文件不重复，只描述**本地增量如何嵌入同一套体系**，以及当前可执行范围。

## 结合方式

本地测试不是第二套体系，而是落在上游既有的三个约定位置里：

| 层 | 位置 | 谁维护 | 如何被跑到 |
| :--- | :--- | :--- | :--- |
| 单元测试 | `sidecars/panel/tests/*.test.mjs`、`cli/tests/`、`ide/tests/` | 本地新增文件混入上游目录 | 上游 `npm test` 的 glob 与 CI 三平台矩阵自动覆盖，无需登记 |
| 门禁脚本 | `tools/check-*.mjs` | 上游既有 + 本地新增 | 单个文件可独立执行，退出码 0 即通过 |
| 统一入口 | `tools/local-gate.mjs` | 本地 | 串起上表与跨层步骤，`package.json` 不再增长 |

判定标准：新增测试若需要修改 `package.json` 才能被执行，说明它脱离了上游体系，做法有误。

## 当前基线

2026-11-02，`upstream/main` @ `b1ad237`，macOS 26.5.0 / Node 26.13.0 / Python 3.11。

| 门禁 | 命令 | 结果 | 耗时 |
| :--- | :--- | :--- | ---: |
| Node 单元测试 | `npm test` | 492 项：491 通过 / 1 跳过 / 0 失败 | 22.6s |
| Python 生命周期 | `python3 -m unittest discover -s tests` | 95 项：93 通过 / 2 跳过 | 6.1s |
| 用量视图（本地） | `node tools/check-usage-ui-cdp.mjs` | 12 项检查全通过，`pageErrors` 为空 | 5.0s |
| 本地全量 | `node tools/local-gate.mjs` | 3/3 通过 | ≈34s |

## 已知缺口

以下门禁在本地**当前不可执行**，原因是 `playwright` 未安装，脚本以裸导入方式引用它：

```text
npm run test:ui            15 项   主题 / 内联布局 / 悬停 / 语言 / 冷启动 / 控件生命周期 …
npm run test:usage-ui       4 项   含 check-usage-ui.mjs 的 --ide 变体
npm run test:panel-ui       2 项
npm run test:ide            2 项
npm run test:update-process 3 项
```

这些门禁在 CI 中由 `npm install --no-save --package-lock=false playwright` 提供依赖后执行。本地补齐方式与上游一致，不写 `package.json`（该文件位于禁改区）：

```bash
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tools/local-gate.mjs --full      # 解锁全部 5 组浏览器门禁
```

`node_modules/` 已在 `.gitignore` 中，此操作不产生提交。

本地 `tools/check-usage-ui-cdp.mjs` 存在的意义即覆盖这个缺口的一部分：它零依赖直连系统 Chrome 的 CDP，不下载浏览器。但它只覆盖用量视图一条主路径，不能替代上述 26 项检查。

## 门禁矩阵的责任划分

| 缺陷类型 | 必跑 |
| :--- | :--- |
| 账本 / 统计 / 定价逻辑 | `npm test`（含 `usage.test.mjs`、`pricing.test.mjs`、`usage-hours.test.mjs`） |
| 渲染注入顺序、导出形制 | `npm test` + `node tools/check-usage-ui-cdp.mjs` + [`contracts.md`](contracts.md) 第 1 节列的七处提取点 |
| 安装 / 更新 / 打包 | `npm run test:lifecycle` + CI 的 `python manage.py package`、`python ide/package.py` |
| 新增或迁移文件 | 追加 [`contracts.md`](contracts.md) 第 2 节的四处白名单登记 |

## 反向断言纪律

每修复一个本地缺陷，必须在测试集中留下可机器验证的反向断言，否则该缺陷会在下一次上游同步时静默复活。已建立的反向锁示例：

| 缺陷 | 反向锁 |
| :--- | :--- |
| 旧分账号目录重复计入 | 「every account on the device resolves to the one unified ledger directory」 |
| 打开窗口触发导入 | `check-usage-ui-cdp.mjs` 的 `no import on open` |
| 完整行被误标异常 | `usage-ui.test.mjs` |
| 自研视图被上游文件覆盖失效 | `usage-ui.test.mjs` 读取 `compat/usage-ui.local.cjs`，文件缺失即失败 |
| 注入顺序颠倒导致本地视图不生效 | `check-usage-ui-cdp.mjs` 的 `entry` 与 `single language control` |

新增避坑条目（[`anti-patterns.md`](anti-patterns.md)）时，同步检查本节是否需要增加一行。
