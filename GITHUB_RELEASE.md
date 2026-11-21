# Antigravity 仪表盘 v0.8.20 发版说明

### 核心更新与说明

- **TPS 速率口径修正**：修正会话速率计算方式，将正文与思考 Token 全量计入速率分子，对齐模型总流式耗时，精准反映模型生成吞吐。
- **文案消除除法歧义**：优化前端状态栏与面板说明文案，消除正文与思考输出展示中的斜杠除法歧义，清晰呈现各部分 Token 明细。
- **凭据机制适配**：适配 Antigravity v2.34.0+ 环境变量 CSRF 凭据传递机制，增强后台进程与指标探查的稳定性。
- **无障碍与焦点加固**：完善用量弹窗无障碍规范，补全 `aria-modal="true"` 并实现 Shadow DOM 内部首尾焦点元素循环闭环，防止无头自动化测试焦点逃逸。
- **跨平台 CI 验证保障**：加固 macOS、Linux 与 Windows 多平台无头浏览器启动检测与自动化门禁，对齐 Node.js 22 LTS 运行环境。

---

*详细更新历史请参阅 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md) 与 [CHANGELOG.md](CHANGELOG.md)。*
