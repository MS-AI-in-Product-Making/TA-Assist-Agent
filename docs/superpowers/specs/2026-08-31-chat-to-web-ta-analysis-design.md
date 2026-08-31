# Chat-to-Web TA Analysis 设计规格

## 1. 目标

用户在 VS Code GitHub Copilot Chat 中通过 TA Assist participant 输入自然语言请求：

```text
帮我分析这份 TA 报告
帮我分析 C:\TA Reports\report.xlsx
帮我分析 "C:\TA Reports\report.xlsx"
```

系统创建一个真实、可立即绑定的受管 Session，打开 TA Assist Web。若消息包含合法绝对 `.xlsx` 路径，VS Code Host 自动导入 workbook 并启动现有 F0-F6 流程；若没有路径，Web 停在 workbook upload 状态，等待用户选择文件。Chat、Web、Host 使用同一 Session ID、SessionStore、artifact lineage 和进度事件。

## 2. 非目标

- 不改变 F0-F7 的业务计算与 artifact ownership。
- 不让 Web 或 Server 任意读取客户端路径。
- 不把本地绝对路径写入 Session、artifact、日志、URL 或模型 prompt。
- 不执行远程 ADO 写入。
- 不要求普通 Copilot Chat 自动接管；入口是注册的 `@ta-assist` participant，支持自然语言请求及 `/analyze`。
- 不重写 F0-F6 已有业务能力；F8 只负责 Session 编排、受管导入、进度同步和 UI 投影。

## 2.1 Worksheet Layout Constraint

`Tolerance loop stack-up` 与 `TA Factor Table` 默认上下排列，而不是左右压缩。Evidence 区域全宽显示图片和 analysis target；Factor Table 在其下方使用完整内容宽度。桌面不允许表格水平滚动或通过过窄列隐藏信息；输入控件必须保持可读可操作尺寸。移动端保持相同阅读顺序，表格仅在无法满足最小可读宽度时允许局部滚动，页面本身不得横向溢出。

## 3. Chat Intent

新增确定性 parser：

```ts
interface TaAnalyzeIntent {
  readonly kind: "analyze_ta";
  readonly workbookPath?: string;
}
```

识别中文/英文 TA 分析表达，并提取消息中的 Windows 绝对 `.xlsx` 路径。支持双引号路径和裸路径；裸路径以 `.xlsx` 结束。拒绝：

- 相对路径
- `file://`、HTTP/HTTPS URL
- 非 `.xlsx`
- 多个 workbook 路径（要求用户明确一个）
- NUL/control characters

Parser 只识别字符串，不访问文件系统。文件存在性与物理路径验证由 VS Code Host import 阶段完成。

## 4. Session-first Launch

现有 `pending`/browser-created Session 改为 launcher-created Session：

1. CLI launcher 生成 Session ID，并通过 SessionStore 创建 revision 0 snapshot。
2. Workbench Server 使用 `resumeSessionId` 启动并签发 session-bound bootstrap。
3. CLI 返回真实 `{ sessionId, url }`。
4. VS Code Extension 同时设置 `activeSessionId`、`activeWorkbenchUrl` 并写入 globalState binding。
5. Browser 打开同一 Session URL。

`workbench` 可保留纯浏览器新建行为，但 Chat `analyze` 必须使用 session-first launch。

## 5. Host Workbook Import

如果 intent 含 workbook path：

1. Extension 使用用户消息中明确提供的路径。
2. 使用 `lstat`/`realpath` 验证：存在、普通文件、非 symlink、扩展名 `.xlsx`、文件大小不超过现有 workbook 限制。
3. Extension 读取 bytes 后，通过父子进程 IPC 发送：`requestId`、`sessionId`、`fileName`、`bytes`。IPC 不发送路径。
4. CLI child 调用 Workbench Server 的受限 host-import API。
5. Server API 复用 `storeUpload`，注册 artifact，并通过现有 `upload_workbook` command/reducer/queue 启动流程。
6. IPC 只返回 `{ artifactId, contentHash, snapshotRevision, state }` 或 sanitized typed error。

Host import API 不作为 HTTP route 暴露，不接受 filesystem path，不绕过 workbook signature/OOXML/size/Session validation。

## 6. No-path Flow

若 intent 无路径：

- 创建并绑定真实 Session。
- 打开 Web。
- Snapshot 保持 `created`/`workbook_required` 业务投影。
- Chat 回复 `TA Assist Workbench is ready. Upload a workbook to begin.`
- 用户在 Web 选择 workbook 后使用已有 multipart upload 和 `upload_workbook` command。

## 7. Chat UX

有路径且导入成功：

```text
Workbook accepted. Session <id> is running in TA Assist Workbench.
```

无路径：

```text
TA Assist Workbench is ready. Upload a workbook to begin.
```

失败：显示 sanitized reason 与可执行下一步，不显示本地完整路径。后续 participant 消息自动使用 `activeSessionId`，无需手工 `/resume`。

## 8. Concurrency And Recovery

- 每个 analyze 请求创建唯一 Session。
- Extension 同时只维护一个 active binding，但旧 Session 仍可通过 `/resume` 打开。
- import IPC 使用 requestId 关联，并有一次性 terminal response。
- 重复 IPC requestId 不得重复上传或创建第二个 attempt。
- Server/Extension 重启后 globalState binding 可恢复；SessionStore 为权威。
- Browser/SSE 断开不停止后台分析。

## 9. Security

- 仅 TA Assist participant 当前消息内明确路径可读。
- 不扫描目录、不解析通配符、不追随 symlink。
- IPC bytes 有现有大小上限；错误中不回显路径。
- Server 重新校验 OOXML signature/structure，不信任 Extension 校验。
- 本地路径不得写入 model context 或 ConversationStore。
- Browser 不获得 Host bearer 或 import IPC 能力。

## 10. E2E Acceptance

### Case A: Path supplied

1. 模拟 `@ta-assist 帮我分析 "C:\...\valid.xlsx"`。
2. 验证真实 Session ID 返回并绑定。
3. 验证 Web 打开同一 Session。
4. 验证 workbook 自动成为 managed artifact，Session 进入 F0/F1-F2。
5. 验证 Web 显示实时 F0-F7 progress。
6. 使用真实 workbook 完成 F0-F6，验证 artifact hashes 与 `review_required`。

### Case B: No path

1. 模拟 `@ta-assist 帮我分析这份 TA 报告`。
2. 验证 Web 打开同一真实 Session，显示 upload state。
3. 通过 Web 上传 workbook。
4. 验证进入与 Case A 相同的受管流程。

### Negative cases

- missing path
- directory
- symlink
- non-xlsx
- malformed OOXML
- multiple paths
- oversized file
- duplicate IPC request

所有 negative cases fail closed，不泄露路径、不产生分析 attempt 或远程 side effect。

## 11. Test Layers

- Parser unit tests
- Launcher/session binding tests
- IPC host import tests
- Server host-import integration tests
- Extension participant tests
- Playwright path/no-path E2E
- One real workbook governed run
- Existing Web/Server/Contracts/Extension regression suites

## 12. 完成标准

- Chat analyze 不再返回 `pending`。
- 有路径自动处理，无路径等待 Web upload。
- Chat/Web/Host 始终共享同一 Session ID。
- 本地路径不进入持久化或 Web。
- Case A、Case B、negative E2E 通过。
- 真实 workbook 运行达到预期终态，或以明确业务阻塞状态结束；不能无进度卡死。
