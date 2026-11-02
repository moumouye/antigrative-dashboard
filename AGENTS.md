# AGENTS.md

本仓库是上游项目的二次开发分支。上游每天可能发版，本地增量必须与之共存。

## 铁律

1. **新增文件优先。** 改一处功能，先问能否用新文件实现；必须改上游文件时，先查 [`docs/boundaries.md`](docs/boundaries.md) 的分区，禁改区改动需要明确理由。
2. **不重命名、不重排目录。** 文件路径同时被测试 glob、打包白名单、CI 引用，任一改名打断三处。
3. **不建平行体系。** 测试进上游 glob 目录，门禁进 `tools/check-*.mjs`，文档进 `docs/`。见 [`docs/anti-patterns.md`](docs/anti-patterns.md) AP-003。
4. **事实只有一个出处。** 上游已描述的内容只写指针，不复制正文。上游文档不得被本地引用反向依赖。
5. **同步用 cherry-pick，不用 merge。** `git fetch upstream` 后逐条取用。AP-006。
6. **改动落地前跑门禁。** `node tools/local-gate.mjs`；涉及渲染、安装、打包时按 [`docs/verification.md`](docs/verification.md) 的矩阵加跑。

## 动手前

```bash
node tools/local-gate.mjs --list        # 当前门禁计划
git log --oneline main..upstream/main   # 上游已有哪些新提交
```

判断改动落在哪个分区：`docs/boundaries.md` 的分区表。禁改区文件（`package.json`、`plugin.json`、`CHANGELOG.md`、`compat/inline-widget.cjs`、`compat/usage-ui.cjs` 等）每次触碰都要记录动机。

## 收工前

```bash
node tools/local-gate.mjs               # 零依赖全量，约 34s
```

失败即停，修完再提交。修复缺陷时同步补反向断言，否则该缺陷会在下次上游同步时静默复活。

## 提交

```
<type>(<scope>): <结果>

- **Why**: 改动动机或缺陷根因
- **How**: 核心实现方式
- **Caveats**: 放弃的备选方案、已知边界
```

`type` 取 `feat` `fix` `refactor` `test` `docs` `chore`。一次提交只做一件事，不 `git add -A`。标题行沿用仓库既有风格，不加 emoji 前缀。

向 `upstream` 提 PR 时改用上游的提交风格，不混用本文件的决策档案格式。`upstream` 已设 `pushurl=no_push`，本地改动不会误推。

## 文档

| 想知道 | 读 |
| :--- | :--- |
| 系统结构与文档地图 | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| 这处改动会不会造成长期冲突 | [`docs/boundaries.md`](docs/boundaries.md) |
| 注入点、打包、版本、测试的接口约定 | [`docs/contracts.md`](docs/contracts.md) |
| 已经否决过什么方案 | [`docs/anti-patterns.md`](docs/anti-patterns.md) |
| 该跑哪些门禁、基线是多少 | [`docs/verification.md`](docs/verification.md) |
| 本地为什么有这处改动 | [`docs/LOCAL_CHANGES.md`](docs/LOCAL_CHANGES.md) |
| 上游怎么描述结构、测试、数据边界 | [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) |

本地真理库采用小写文件名，上游文档为全大写，用命名区分归属。真理库覆盖式维护，只反映当前实现，历史流水不复述。
