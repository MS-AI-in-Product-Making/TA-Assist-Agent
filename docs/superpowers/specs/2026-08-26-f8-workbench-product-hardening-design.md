# F8 Workbench 产品化优化设计

**状态：** 用户批准
**日期：** 2026-08-26
**基础设计：** `2026-08-26-f8-ta-engineering-workspace-ui-design.md`

## 目标

将已完成F0-F6计算链的本地TA工作台补齐为可重复打开、可与VS Code产物对照、可解释ADO交互、可进行完整Scenario计算、可查看F6结论并获得真实Assistant响应的产品体验。

## 批准范围

1. 浏览器session认证在Server重启后可恢复；session ID本身不是凭据，新浏览器仍需一次性bootstrap。
2. 每个session生成可在VS Code查看的同步记录目录，包含snapshot、artifact manifest、Markdown摘要、Scenario与Conversation记录。
3. Web的ADO选择通过HostAction交给VS Code Extension和Surface MCP；浏览器不持有凭据，写入必须二次确认。
4. 公差修改自动更新Factor contribution与Worksheet Mean/RSS/WC/Cp/Cpk/Margin/DPM/Yield；Nominal和Mean Shift只有存在signed direction证据时可编辑。
5. Web增加F6 Summary，展示workbook/worksheet disposition、候选数量、证据缺口和报告入口。
6. Web消息通过HostAction交给VS Code Language Model；host离线时明确显示未连接，不允许无反馈发送。

## 安全边界

- cookie使用本地持久密钥HMAC签名，HttpOnly、SameSite=Strict；不在cookie中存CSRF token。
- Session Record只写`runtime/workbench/session-records/<sessionId>`，原子写入，不复制源Workbook。
- ADO与Assistant均由短期、session/action/host绑定的Bearer领取。
- signed direction必须来自governed artifact，浏览器不得推断。
- 所有UI指标来自validated F4/F6 JSON，不从Markdown解析。

## 实施顺序

1. 持久认证与resume URL。
2. Session Record投影与VS Code打开命令。
3. F6 UI Summary。
4. Assistant HostAction和离线状态。
5. signed direction合同与完整Scenario同步计算。
6. ADO业务对话框、预览、确认、Surface MCP receipt。
7. 真实Workbook与Server重启验收。
