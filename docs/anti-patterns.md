# 避坑档案

已实测否决的方案与失效根因。每条对应一个可复现的代价，不是风格偏好。

## AP-001 全树 JavaScript 迁移 TypeScript

**否决日期**：2026-11-02

**方案**：把 122 个 `.mjs` 与 9 个 `.cjs` 重命名为 `.ts`，引入 `tsconfig` 与构建步骤，产物回填运行路径。

**否决理由**：

1. 冲突类型升维。上游改动一个 `.mjs` 时，本地对应的 `.ts` 属于 rename/modify 冲突，git 的三方合并无法自动处理，每个文件都要人工裁决；而当前的同文件改动只需解行级冲突。
2. 打断三条既有链路。运行时直接加载源文件（`ide/main.mjs` 读文本注入、sidecar 以 `node xxx.mjs` 启动）；打包白名单按文件名硬列举（[`contracts.md`](contracts.md) 第 2 节）；测试 glob 按 `.test.mjs` 匹配。三者都需要同步改造，且它们全部位于禁改区。
3. 零依赖原则破产。当前仓库 `devDependencies` 为空、无构建步骤；引入 TS 即引入 `typescript` 依赖与构建产物路径，与上游 CI 的 `npm test` 直跑模型冲突。

**替代**：`// @ts-check` + JSDoc 类型注释 + `npx -y typescript tsc --noEmit`。文件不重命名、不产生构建产物、不进入运行路径，取得类型检查收益的同时冲突面积为零。

**代价**：JSDoc 不能使用 TS 的高级类型能力（条件类型、装饰器、`satisfies` 等部分语法）。对 21k 行的规模，实测收益差距不足以抵消冲突成本。

## AP-002 直接改写上游渲染文件

**否决日期**：2026-11-02

**历史方案**：在 `compat/usage-ui.cjs` 内直接实现 24 小时图表、成本估算、组件筛选，累计 +959/-182 行。

**失效根因**：该文件上游 churn 为 10/60，且是渲染层的单点入口。上游任何一次重构都会在本地 1141 行改动上产生大面积冲突，人工裁决成本与上游发版频率成正比。

**替代**：把本地实现整体迁到新路径 `compat/usage-ui.local.cjs`，上游文件回归原样，注入序列末尾追加一项覆盖工厂：

```js
// 注入顺序：上游文件先赋值，本地文件后覆盖同一全局变量
const files = await Promise.all([…5 项原有路径…, 'compat/usage-ui.local.cjs'].map(…));
const usageLocalSource = `window.__agPulseUsageFactory=(${extract(files[5])});`;
makeRendererSource(…, usageSource + usageLocalSource);
```

冲突面积从 1141 行降至 `ide/main.mjs` 的一处数组追加（churn 8/60，且该文件本地仅 2 行改动）。

**为什么不是包裹（wrap）**：实测差异为 46 个差异块、325 行被改写为 1102 行，工厂内部 DOM 结构整体重建，`api` 返回面不同。包裹只能装饰既有 `api`，无法替换内部渲染逻辑。因此采用覆盖式替换，上游文件仍参与注入但立即被覆盖，保留为基线参考与降级回退路径。

**代价**：上游对 `compat/usage-ui.cjs` 的后续改动**不会自动生效**，因为整条工厂被覆盖。需要时人工对比移植：

```bash
git diff $(git rev-parse upstream/main~20)..upstream/main -- compat/usage-ui.cjs
```

这是可接受的：本地版本已重新实现该视图的核心呈现（24 小时图、成本、组件筛选），上游在此文件上的增量多为同一视图的另一种实现，直接套用会覆盖本地能力。

## AP-003 建立平行测试或平行文档体系

**否决日期**：2026-11-02

**方案**：本地新建 `tests-local/`、`docs-local/`、`gates/` 等独立目录，与上游体系并列。

**失效根因**：两套体系会各自漂移成两份真相。上游 CI 只跑 `npm test` 的 glob，平行目录里的测试永远不会在 Windows/Linux/macOS 矩阵上执行，缺陷只在本地被发现；文档同理，同一事实写两遍后必然出现互相矛盾的版本。

**替代**：

- 测试就地放入上游 glob 目录 —— 新增文件自动被 `npm test` 与 CI 覆盖，零配置；
- 门禁沿用 `tools/check-*.mjs` 约定，汇总入口集中在 `tools/local-gate.mjs`（单文件，自建区）；
- 文档用**文件名大小写区分归属**（全大写为上游、小写为本地），详见 [`ARCHITECTURE.md`](../ARCHITECTURE.md) 的归属约定，落盘位置统一在 `docs/`。

## AP-004 把本地变更记进上游 CHANGELOG.md

**否决日期**：2026-11-02

**方案**：沿用上游发版习惯，在 `CHANGELOG.md` 追加本地条目。

**失效根因**：`CHANGELOG.md` churn 26/60，是上游改动最频繁的文件。每次上游发版都会重写版本段落，本地追加的条目必然落在冲突区，且合并后极易被上游版本标题吞并而丢失。

**替代**：本地流水记入 [`LOCAL_CHANGES.md`](LOCAL_CHANGES.md)（churn 0）。`CHANGELOG.md` 保持上游原样。

## AP-005 每新增一个门禁就改 package.json

**否决日期**：2026-11-02

**方案**：新增 `check-*.mjs` 后在 `package.json` 的 `scripts` 里登记一条。

**失效根因**：`package.json` churn 20/60，且 `scripts` 段落是上游每次发版都在编辑的区域。本地每加一条脚本就多一处冲突点，且该冲突往往与版本号冲突叠加在同一文件同一段。

**替代**：`package.json` 只保留一个稳定入口 `gate`，本地门禁清单由 `tools/local-gate.mjs` 持有。新增门禁只改后者，前者从此冻结。

## AP-007 只改一条加载路径就宣布搬迁完成

**否决日期**：2026-11-03

**历史方案**：把 `usage-ui.cjs` 的实现迁到 `usage-ui.local.cjs` 时，只更新了 `ide/main.mjs` 与七处门禁，把 `compat/usage-ui.cjs` 还原成上游原样。

**失效根因**：视图文件有两条独立注入管线，App 与 IDE 互不共用。`sidecars/panel/main.mjs:43` 是 App 那条线的入口，仍按文件名写死读 `usage-ui.cjs`；另有三个工具（性能门禁、侧栏门禁、README 截图）同样按名加载。门禁全绿只是因为门禁自己也已经被改成读新路径 —— **被测物与测试同时搬迁，等于互相担保**。真正的爆炸点在重装插件之后：App 会加载已被还原的上游 325 行版本，界面退回简版，而本地任何检查都不会报错。

同类残留还有打包白名单两处、更新链路必需文件清单一处。判定一个文件搬迁是否完成，唯一可靠的方法是**全仓库按文件名检索**，不是跑门禁：

```bash
grep -rn "usage-ui\.cjs" --include=*.mjs --include=*.cjs --include=*.py . | grep -v node_modules
```

**替代**：所有消费者统一走 `compat/usage-view.mjs` 的 `usageViewPath()`，解析与回退集中在一处；新增消费者时先接解析器，不再自行拼路径。回退语义保证旧安装（只有单文件）不会因为缺文件而崩。

**教训**：跨进程、跨语言的加载路径不受任何单一测试覆盖。搬迁类改动必须以「引用点枚举」收尾，不能以「门禁通过」收尾。

## AP-006 用 merge 吸收上游更新

**否决日期**：2026-11-02

**方案**：`git merge upstream/main` 把上游整体并入主干，冲突一次性解完。

**失效根因**：merge 会把上游对禁改区的**覆盖式改写**当作已接受的合并结果，本地在该文件中的全部改动被视为"已解决"，实际上是被静默丢弃或强行保留二者之一 —— 两种情况都需要逐行复核 1141 行量级的改动。此外 merge 提交会让后续每个上游提交都带上合并图噪声，`git log main..upstream/main` 失去可读性。

**替代**：`git fetch` + 逐条 `cherry-pick`。每条上游修复独立落地，可单独回退，冲突局限在单条提交涉及的文件。
