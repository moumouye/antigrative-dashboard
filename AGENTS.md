# AGENTS.md

本仓库为主维护源（原上游项目 `YOU-SHOULD-KNOW-ME/antigrative-dashboard` 已删库，由本仓库 `moumouye/antigrative-dashboard` 接管为主源继续维护与发版）。

## 铁律

1. **新增文件优先。** 改一处功能，先问能否用新文件实现；模块变更遵循架构分层。
2. **不重命名、不重排目录。** 文件路径同时被测试 glob、打包白名单、CI 引用，任一改名打断三处。
3. **不建平行体系。** 测试进标准 glob 目录，门禁进 `tools/check-*.mjs`，文档进 `docs/`。见 [`docs/anti-patterns.md`](docs/anti-patterns.md) AP-003。
4. **事实只有一个出处。** 系统架构与契约只写指针，不复制正文。
5. **发布规范化。** 发版走 `python manage.py package` 与 GitHub Actions Release 自动流水线，支持单脚本 `install.py` 一键安装。
6. **改动落地前跑门禁。** `node tools/local-gate.mjs`；涉及渲染、安装、打包时按 [`docs/verification.md`](docs/verification.md) 的矩阵加跑。

## 动手前

```bash
node tools/local-gate.mjs --list        # 当前门禁计划
git status                              # 检查当前分支与未提交改动
```

查阅 `docs/boundaries.md` 确认改动是否触碰物理红线与模块职责。核心文件（`package.json`、`plugin.json`、`compat/inline-widget.cjs` 等）每次触碰都要记录动机。

## 收工前

```bash
node tools/local-gate.mjs               # 零依赖全量，约 34s
```

失败即停，修完再提交。修复缺陷时同步补反向断言，杜绝同类问题二次逃逸。

## 提交

```
<type>(<scope>): <结果>

- **Why**: 改动动机或缺陷根因
- **How**: 核心实现方式
- **Caveats**: 放弃的备选方案、已知边界
```

`type` 取 `feat` `fix` `refactor` `test` `docs` `chore`。一次提交只做一件事，不 `git add -A`。标题行沿用仓库既有风格，不加 emoji 前缀。

## 文档

| 想知道 | 读 |
| :--- | :--- |
| 系统结构与文档地图 | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| 模块职责与物理安全红线 | [`docs/boundaries.md`](docs/boundaries.md) |
| 注入点、打包、版本、测试的接口约定 | [`docs/contracts.md`](docs/contracts.md) |
| 已经否决过什么方案与暗知识 | [`docs/anti-patterns.md`](docs/anti-patterns.md) |
| 该跑哪些门禁、基线是多少 | [`docs/verification.md`](docs/verification.md) |
| 历史决策与架构演进里程碑 | [`docs/LOCAL_CHANGES.md`](docs/LOCAL_CHANGES.md) |
| 基础目录结构、原生环境要求与核心测试规范 | [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) |

真理库覆盖式维护，只反映当前实现，历史流水不复述。
