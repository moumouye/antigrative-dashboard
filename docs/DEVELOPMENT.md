# 本地开发与联调指南 (Local Development & Verification)

本文档面向贡献者与开发者，介绍本地运行预览、联调测试与数据边界规范。
系统整体拓扑与真理库地图请参阅根目录 [ARCHITECTURE.md](../ARCHITECTURE.md)。

---

## 1. 自动化质量门禁 (Verification Gates)

本项目严禁直接执行分散的不完整测试。代码提交与发布前，必须统一执行根目录自动化门禁：

```bash
node tools/local-gate.mjs
```

该门禁串联并校验：
1. **Node.js 单元测试**：`npm test`（覆盖速率算法、去重、账本聚合与定价模型）；
2. **Python 生命周期测试**：`python3 -m unittest discover -s tests`（覆盖安装、启停、卸载、目录备份幂等性）；
3. **真实环境 CDP 测试**：`node tools/check-usage-ui-cdp.mjs`（通过系统 Chrome 远程调试端口进行 Shadow DOM 端到端验证）。

详细分层矩阵与四大物理不变量断言标准请查阅 [docs/verification.md](verification.md)。

---

## 2. 本地实时预览与热调试 (Live Preview & Hot Reload)

### 独立 Webview 面板本地预览
```bash
node sidecars/panel/main.mjs
```
启动后在浏览器打开 `http://127.0.0.1:17891` 即可预览独立看板：
* `/toolbar-preview?new`：验证新对话空状态同行布局；
* `/toolbar-preview`：关联最近一次活跃会话。

### 宿主免重启热重载
若宿主程序已在运行，修改 `compat/usage-ui.cjs` 后无需重启宿主 Electron 进程，直接在终端执行：
```bash
npm run ui:reload
```
脚本将通过 CDP 调试通道将最新源码动态热注入宿主当前页面中。

---

## 3. 数据边界与隐私隔离规范 (Data Boundaries)

系统在本地开发中必须严格遵循数据边界：
1. **零账号凭据接触**：安装与运行时代码严禁读取、存储或传输用户 API 密钥与登录凭据；
2. **零会话正文持久化**：本地服务仅向渲染端传递数值元数据（Tokens、时间戳、模型标识与状态），严禁将对话正文、Prompt 提示词保存至磁盘；
3. **纯静态离线计费**：价格表内置于 `sidecars/panel/pricing.mjs`，严禁发起外部网络请求。

---

## 4. 手动实机验收走查 (Manual Acceptance Checklist)

安装或重装后走查步骤：
1. 完全重启 Antigravity 宿主程序；
2. 新建会话：输入框模型选择旁应显示监控条（新会话显示占位横线，悬停展示额度详情）；
3. 产生对话后：实时刷新 TPS 速率、缓存命中率与上下文占用比例；
4. 额度切换：点击上下文卡片底部菜单选择不同 Quota 组，进度与重置倒计时应即时联动；
5. 查看用量：点击「查看用量统计」，正确呼出 24 小时日内条形图与成本估算面板。
