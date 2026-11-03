# 契约

本地改动与上游结构之间的接口约定。破坏任一条，门禁与发行包会在不相关的地方报错。

## 1. 渲染层注入契约

`compat/*.cjs` 不是被 `import` 的模块，而是被读成**源码文本**注入 webview。App 与 IDE 是两条独立管线，各有自己的注入点。

### 统一解析器

视图文件的位置只有一个判定处，任何消费者都不得自行拼路径：

```js
// compat/usage-view.mjs
export function usageViewPath(){
  const local = join(here,'usage-ui.local.cjs');
  return existsSync(local) ? local : join(here,'usage-ui.cjs');
}
export function usageViewExpression(source){ /* 取出 module.exports 后的函数表达式 */ }
```

`compat/usage-ui.local.cjs` 存在时优先，缺失时回退 `compat/usage-ui.cjs`。这条回退保证旧安装（只有单文件）不会因为缺文件而崩，也保证重装后自动切到本地实现。

消费者共四处，必须全部走解析器：

| 消费者 | 作用 |
| :--- | :--- |
| `sidecars/panel/main.mjs:43` | App 运行时的页面注入 |
| `ide/main.mjs:29` | IDE adapter 的页面注入，同时显式加载基线与本地两份 |
| `tools/check-usage-performance.mjs` | 性能门禁 |
| `tools/render-readme-assets.mjs` | README 截图生成 |

### App 管线

```js
// sidecars/panel/main.mjs:43
const usageSource = () => {
  const s = readFileSync(usageViewPath(),'utf8');
  return `window.__agPulseUsageFactory=${usageViewExpression(s)};`;
};
```

### IDE 管线

```js
// ide/main.mjs:29
const files = await Promise.all(['compat/i18n.cjs','compat/inline-widget.cjs',
  'compat/theme.cjs','ide/surface.cjs','compat/usage-ui.cjs','compat/usage-ui.local.cjs']
  .map(f => readFile(join(root,f),'utf8')));
// ide/main.mjs:35  注意 files[4] 与 files[5] 是硬编码下标
const usageSource = `window.__agPulseUsageFactory=(${extract(files[4])});window.__agPulseUsageFactory=(${extract(files[5])});`;
```

约束：

- 每个 `.cjs` 必须有且仅有一处 `module.exports = `，其后为单个函数或类表达式，否则截出的字符串语法错误；
- 数组顺序即注入顺序，`files[4]` 之类的下标是硬编码的，增删数组元素必须同步下标；
- 注入只产生全局工厂函数，不产生模块作用域，跨文件通信一律走 `window.__agPulse*Factory`；
- **同一全局变量允许被后续注入项覆盖**。IDE 管线先赋上游基线再赋本地实现，顺序不可颠倒。

### 注入时机

页面只在 App 启动、渲染进程就绪时注入一次。注入后页面里是内存中的函数对象，磁盘文件再改也不会自动生效。验证新代码需要重新注入：`npm run ui:reload`（CDP 热重载）或完全退出 App 重开。

消费端是**惰性调用**，因此工厂赋值晚于 `inline-widget.cjs` 执行是安全的：

```js
// compat/inline-widget.cjs:669
if (window.__agPulseUsageFactory) { … }
// compat/inline-widget.cjs:679
usageDashboard = window.__agPulseUsageFactory({root, language, setMarkup, hostLabel, …});
```

### 门禁提取点

以下七处门禁按同一规则提取源码，统一指向 `compat/usage-ui.local.cjs`：

```text
tools/check-usage-ui.mjs        tools/check-usage-ui-cdp.mjs
tools/reload-live-ui.mjs        tools/check-teamwork-ui.mjs
tools/check-cold-start-ui.mjs   tools/check-collection-state-ui.mjs
tools/check-widget-lifecycle.mjs
```

修改注入顺序或导出形制，必须同步这些提取点，否则门禁失败位置会与真实故障点无关。新增消费者时先接解析器，不要再拼路径（教训见 [`anti-patterns.md`](anti-patterns.md) AP-007）。

## 2. 打包契约

发行包按文件名硬列举，新增文件不登记就发布不出去。迁移 `usage-ui` 逻辑时必须同时更新：

| 位置 | 作用 |
| :--- | :--- |
| `ide/package.py:10-14` | VSIX 的 `MODULES` 列表 |
| `tools/publish-release.py:32` | 桌面包必含资产校验 |
| `tools/publish-release.py:62` | IDE 包必含资产校验 |
| `tools/check-update-cwd.mjs:67` | 更新链路的必需文件清单 |

## 3. 版本契约

版本号在三处同步，上游发版时三处同时变化，是确定性冲突点：

```text
package.json  version = 0.8.19
plugin.json   version = 0.8.19
ide/package.json version = 0.8.19
```

本地与上游版本号会持续分叉。纪律：只在发版时改动这三行的版本号，冲突时一律取**本地版本号**，不参与上游的版本推进；版本语义由 [`LOCAL_CHANGES.md`](LOCAL_CHANGES.md) 记录。

## 4. 测试契约

| 项 | 约定 |
| :--- | :--- |
| 单元测试位置 | `sidecars/panel/tests/*.test.mjs`、`cli/tests/*.test.mjs`、`ide/tests/*.test.mjs` |
| 自动纳入上游入口 | 是。`npm test` 的 glob 与 CI 的 `npm test` 直接覆盖新增测试文件，无需改任何配置 |
| 门禁脚本位置 | `tools/check-*.mjs`，单文件可独立执行，成功退出码 0 |
| 第三方依赖 | 零。上游 [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) 明确「无 npm / pip 第三方依赖」，本地门禁同样遵守：`check-usage-ui-cdp.mjs` 走系统 Chrome 的 CDP，不引入 Playwright |
| 本地增量入口 | `tools/local-gate.mjs`，见 [`verification.md`](verification.md) |

新增测试文件不得另建目录。放进上游 glob 即自动被 `npm test`、`npm run test:ui` 的 CI 全平台矩阵执行，这是本地测试与上游测试「结合」的实现方式，不是巧合。

## 5. 上游同步契约

```bash
git fetch upstream
git log --oneline main..upstream/main        # 看新增
git cherry-pick <sha>                        # 逐条取用
```

- 禁止 `git merge upstream/main`：会把上游对禁改区的覆盖式改写直接引入；
- `upstream` 的 `pushurl` 为 `no_push`，写入通道已封死；
- 每次同步后按 [`boundaries.md`](boundaries.md) 末尾的触发条件复核分区。
