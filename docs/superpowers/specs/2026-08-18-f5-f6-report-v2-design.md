# F5/F6 TA 报告 V2 优化设计

**日期：** 2026-08-18
**状态：** 已批准
**分支：** `user/xumax/F6-report_op`
**替代范围：** `f6-optimization-v1`、`f6-composed-report-v1` 及联合报告固定十章设计
**依赖：** F2 validated report、current-run F3 governance、F4 `excel-ta-v1` calculation、F5 governed interpretation、F5 image observation v2（可选）

## 1. 背景

当前 F5/F6 已具备确定性计算、证据分类、身份绑定、图像观察门禁、供应商/datum/cost evidence gate、原子发布和 hash 校验。当前输出仍有以下不足：

- F5 固定五章，联合报告固定十章，无法完整表达设计评审所需的 16 章 TA 报告。
- 联合报告以字符串摘要为主，公式、输入、输出、证据类型、可信度和限制条件未形成统一机器合同。
- RSS、Worst Case、预测性能力和实测能力没有在报告模型中严格分层。
- 数据缺口没有统一的 P0/P1/P2 优先级和最终判定影响。
- F6 自动生成 Top 1 收紧 20% 和 Top 3 收紧 30% 场景，不符合“只有用户或受控证据提供改善目标时才量化收益”的新要求。
- Markdown 中存在无意义的高精度小数、英文旧章节名称和不够直接的工程结论。

本设计对 F6 报告合同做破坏性 V2 升级，同时保持 F4 为唯一计算真源，禁止 renderer 或 composed builder 自行重新实现工程数学。

## 2. 已批准决策

1. `f6-composed-report-v2` 直接替换 v1，不保留 v1 验证兼容。
2. 只有 F5+F6 联合报告使用完整 16 章；F5/F6 独立报告保留各自职责并做中文化与证据增强。
3. 联合报告最终判定改为 `PASS / CONDITIONAL_PASS / FAIL / INCOMPLETE`。
4. 只有 P0 阻断缺口覆盖最终判定为 `INCOMPLETE`；P1/P2 不抹去可靠的 FAIL 或条件性结论。
5. 取消默认 Top 1 -20% 和 Top 3 -30% 量化场景。
6. 新增受控 `Optimization Targets JSON` 和 `--optimization-targets <path>`。
7. F6 继续原子发布同名六文件，不增加输出文件数量。
8. 分析对象类型只接受结构化输入；不得从 worksheet 名、描述文本或图片猜测 Gap/Step 等类型。
9. F4 的 Mean、Worst Case、RSS、Cp/Cpk、Z、DPM、Yield 和 trace records 是报告数值与公式的唯一基线来源。
10. 新增受控 `TA Analysis Context JSON` 和 `--analysis-context <path>`，承载分析对象、方向、工况、功能边界和相关性要求。

## 3. 目标

- 生成中文、16 章、先结论后证据、适用于设计评审和量产能力讨论的联合 TA 报告。
- 所有关键数字包含单位、合理精度、公式、输入、输出和 provenance。
- 严格区分输入事实、计算结果、数学推导、工程假设、工程推断和数据缺口。
- 严格区分 RSS、Worst Case、统计 Margin、Worst Case Margin、预测性能力和实测能力。
- 只用受支持证据形成最终四态判定和设计建议。
- 输入不完整时继续输出现有证据支持的分析，并集中列出 P0/P1/P2 缺口。
- 无 Optimization Targets 时只输出候选 Factor、所需输入和计算方法，不量化改善收益。
- 保持 F2-F6 identity、classification、containment、hash、atomic publish 和 fail-closed 边界。

## 4. 非目标

- 不修改 F4 数学内核或 Excel 一致性公式。
- 不从图片推断 Drawing Number、DIM ID、datum identity、Loop 正负方向或 label-to-row mapping。
- 不把预测 Cpk 表述为实测量产 Cpk。
- 不把预测 Yield/DPM 表述为实际良率或实际缺陷率。
- 不把 Top Contributor 自动表述为根因、超差、供应商能力不足或设计错误。
- 不在缺少成本时计算 ROI。
- 不在缺少用户目标时生成虚构的优化比例和收益。
- 不执行自由单位转换；单位不一致或未知时 fail closed 或形成 P0 缺口。
- 不改变 F3 可选 ADO 发布协议。
- 不增加第七个 F6 输出工件。

## 5. Feature Ownership

### 5.1 F4

F4 是计算真源，负责：

- Factor mean、half tolerance、1σ、variance contribution。
- System mean、additional mean shift、Worst Case upper/lower、RSS σ。
- Cp、Lower/Upper Cpk、Overall Cpk、Z、DPM、Yield 和状态。
- `formulaId`、`formulaVersion`、`outputField` 和 source-cell trace。
- 受控 scenario override 的完整重算。

### 5.2 F5

F5 负责：

- Baseline calculation FACT 的受治理解释。
- F0 interpretation RULE。
- F3 identifier/governance FACT 与 SIGNAL。
- F5 v2 visual FACT 与 contextual SIGNAL。
- Clarification、assumption 和证据限制。
- 公差链、能力和 contributor 的 baseline 解释。

F5 不负责：

- 量化优化目标生成。
- Reverse solve 和 RSS apportionment 的最终场景发布。
- Feasibility、cost、ROI 或方案推荐。

### 5.3 F6

F6 负责：

- 冻结并验证 F4 baseline。
- 读取和验证 Optimization Targets。
- 只为明确目标生成 scenario overrides。
- 调用 F4 kernel 完整重算每个 option。
- Supplier/datum/cost evidence gate。
- Feasibility、risk、impact 和 ROI（仅成本证据完整时）。
- 生成 Optimization v2 和 Composed Report v2。

### 5.4 Composed Builder

Composed builder 只组织、分类和投影 F2-F6 已验证数据。它不得：

- 重新实现 F4 公式。
- 修改数值。
- 把 SIGNAL/ASSUMPTION/INFERENCE 提升为 FACT。
- 从文本或图片补全缺失工程数据。
- 跨 worksheet 合并 Cpk、RSS、Margin 或公差链。

## 6. 版本与兼容策略

### 6.1 新版本

- `f6-optimization-v2`
- `f6-composed-report-v2`
- `f6-optimization-targets-v1`
- `f6-analysis-context-v1`

### 6.2 破坏性迁移

顶层 `contractVersion: "v1"` 继续表示仓库公共 envelope 版本；`optimizationVersion`、`reportVersion`、`targetVersion` 和 `contextVersion` 表示具体 artifact schema 版本。此次破坏性升级只替换 F6 artifact schema，不升级公共 envelope。

当前入口不再接受 `f6-optimization-v1` 或 `f6-composed-report-v1`。Existing-artifact 模式遇到旧版本时返回受控 `unsupported_artifact_version`，不自动转换、不展示未经 v2 schema 验证的内容。Loader、manifest、feature register 和 policy gate 必须只登记当前 v2 F6 artifact IDs。

F1-F5 既有 artifact 版本保持不变。F5 image observation v1 仍遵守其历史只读兼容边界；新 image mode 仍只创建 v2。

### 6.3 六文件保持同名

每次 F6 run 原子发布：

1. `Feature6-Optimization.json`
2. `Feature6-Optimization.md`
3. `Feature6-Composed-Report.json`
4. `Feature6-Composed-Report.md`
5. `Feature6-Run-Summary.json`
6. `manifest.json`

Run summary 和 manifest 记录 v2 schema、输入 provenance 和四个内容工件 hash。

## 7. Optimization Targets 输入合同

V2 共享身份和数值类型：

```ts
type FactorIdentity = {
  worksheetName: string;
  tableId: string;
  sourceRow: number;
  factorName: string;
  unit: string;
};

type BaselineIdentity = {
  calculationVersion: "excel-ta-v1";
  projectReference: string;
  runReference: string;
  workbookContentHash: string;
  worksheetName: string;
  tableId: string;
};

type F6Metrics = {
  mean: number;
  rssSigma: number;
  worstCaseLower: number;
  worstCaseUpper: number;
  cp: number;
  cpk: number;
  yield: number | null;
  dpm: number | null;
};

type ScenarioEvidence = {
  targetId: string;
  baselineIdentity: BaselineIdentity;
  factorOverrides: Array<{
    factor: FactorIdentity;
    upperTolerance?: number;
    lowerTolerance?: number;
    sigma?: number;
  }>;
  calculationReference: ArtifactReference;
  formulaReferences: FormulaReference[];
};
```

```ts
type F6OptimizationTargets = {
  contractVersion: "v1";
  inputClassification: "confidential";
  targetVersion: "f6-optimization-targets-v1";
  workbookContentHash: string;
  worksheets: Array<{
    worksheetName: string;
    tableId: string;
    baselineIdentity: BaselineIdentity;
    targets: Array<
      | {
          targetId: string;
          targetType: "factor_tolerance";
          factor: FactorIdentity;
          upperTolerance: number;
          lowerTolerance: number;
          unit: string;
        }
      | {
          targetId: string;
          targetType: "factor_sigma";
          factor: FactorIdentity;
          sigma: number;
          unit: string;
        }
      | {
          targetId: string;
          targetType: "improvement_ratio";
          factor: FactorIdentity;
          ratio: number;
          appliesTo: "tolerance_band" | "sigma";
        }
      | {
          targetId: string;
          targetType: "system_target";
          systemIdentity: {
            baselineIdentity: BaselineIdentity;
            designNominal: number;
            mean: number;
            rssSigma: number;
            lowerSpecLimit: number;
            upperSpecLimit: number;
            targetCpk: number;
            traceReferences: FormulaReference[];
          };
          target:
            | { targetCpk: number }
            | { targetRssSigma: number; unit: string };
          apportionment: {
            policy: "PROPORTIONAL" | "EQUAL_SELECTED" | "CAPABILITY_BOUNDED";
            selectedFactors: FactorIdentity[];
          };
        }
    >;
  }>;
};
```

### 7.1 验证规则

- 工件必须位于受控 evidence root，路径 contained、non-linked、regular file。
- Workbook hash 必须与当前 run 一致。
- Worksheet、tableId、sourceRow 必须精确绑定当前 F4 baseline。
- 每个 Factor target 携带完整 `FactorIdentity`；worksheetName/tableId 必须与 containing worksheet record 一致，sourceRow/factorName/unit 必须与 F4 baseline 完全一致。
- `baselineIdentity` 必须与当前 F4 calculationVersion、projectReference 和 runReference 完全一致。
- `targetId` 在整个工件内唯一；同一 Factor 的同类 target 最多一个。
- 同一 Factor 的同类目标不得重复。
- `ratio` 必须满足 $0 < ratio < 1$。
- `sigma`、`targetCpk`、`targetRssSigma` 必须为有限正数；`system_target.target` 是非空 discriminated union，不允许空 system target。
- `upperTolerance > lowerTolerance`。
- Factor 目标单位必须与 baseline 单位完全一致。
- `system_target` 绑定其 worksheet/table 的 F4 system specification；`targetRssSigma` 必须同时提供与 baseline 一致的 unit。
- `systemIdentity` 的全部数值和 traceReferences 必须与当前 F4 `system.*`、`capability.lowerSpecLimit`、`capability.upperSpecLimit`、`capability.targetCpk` 精确匹配；不得只凭 worksheet/table 接受 system target。
- `system_target` 必须选择至少一个完整 FactorIdentity，并指定唯一 apportionment policy；不允许 F6 自行选择待收紧 Factor。
- 任一记录无效时拒绝整个 Optimization Targets 工件，不部分接受。
- Supplier、datum 或 cost evidence 不得替代 Optimization Targets。

### 7.2 CLI 与 Skill

直接 CLI 和 app CLI 新增：

```text
--optimization-targets <artifact-path>
```

F6 Skill 在 W8 收集并验证该可选 evidence。存在合法 targets 时，必须展示 workbook、worksheet、Factor identity、目标值、apportionment policy 和预期计算效果的完整预览，并通过独立 `vscode_askQuestions` 取得 `Confirm optimization targets`。取消或拒绝时丢弃整个 targets 工件，继续 candidate-only F6；未经确认不得量化重算。

直接 CLI 或 app CLI 显式传入 `--optimization-targets` 视为非交互调用方对该受控工件的明确授权，并在输出中记录 artifact hash。Skill 模式不得以路径参数本身代替用户确认。未提供 targets 时继续 F6，不视为 workflow failure；Optimization v2 输出候选 Factor、required inputs 和计算方法，option 使用 `candidate` 变体且 reason 为 `target_not_provided`，不生成 scenario metrics。

用户确认的是“允许按这些输入执行量化重算”，不是批准最终设计变更或 recommendation；最终工程决策仍由评审者完成。

### 7.3 System Target 求解责任

- `targetCpk` 由 F6 solver 使用当前 F4 mean、LSL、USL 反解目标 RSS σ。
- `targetRssSigma` 直接作为目标 RSS σ。
- F6 apportionment 仅按调用方明确选择的 policy 和 selectedFactors 生成 factor overrides。
- `PROPORTIONAL` 按 selected baseline variance 比例分配；`EQUAL_SELECTED` 对 selected factors 分配相同目标 σ。
- `CAPABILITY_BOUNDED` 还必须有 supplier capability evidence 覆盖每个 selected factor；缺少时为 `insufficient_evidence`。
- 未选择 Factor、目标不可达或 fixed-factor variance 已超过目标时，不生成 overrides，返回受控 failure/evidence gap。
- 生成 overrides 后必须调用 F4 kernel 完整重算；F6 solver/apportionment 的输出不是最终 scenario metric。

### 7.4 Option V2 Union

```ts
type F6OptionV2 =
  | {
  optionId: string;
      status: "candidate";
      reasonCode: "target_not_provided";
      candidateFactors: FactorIdentity[];
      requiredInputs: string[];
      calculationMethod: string;
      baselineMetrics: F6Metrics;
      resultMetrics?: never;
      scenarioEvidence?: never;
      impactRank: null;
    }
  | {
      optionId: string;
      status: "completed";
      targetId: string;
      baselineMetrics: F6Metrics;
      resultMetrics: F6Metrics;
      scenarioEvidence: ScenarioEvidence;
      impactRank: number | null;
    }
  | {
      optionId: string;
      status: "insufficient_evidence";
      targetId?: string;
      requiredInputs: string[];
      baselineMetrics: F6Metrics;
      resultMetrics?: never;
      scenarioEvidence?: never;
      impactRank: null;
    }
  | {
      optionId: string;
      status: "calculation_failed";
      targetId: string;
      reasonCode: string;
      baselineMetrics: F6Metrics;
      resultMetrics?: never;
      impactRank: null;
    };
```

所有 option 都有稳定且 worksheet 内唯一的 `optionId`；target-driven option ID 由 worksheet identity 与 targetId 确定，candidate 使用受控 `worksheet:candidate` ID。没有 completed 且 evidence-supported 的 option 时，`highestImpactAction` 必须为 `null`，recommendation 只能是 evidence closure，不得给 candidate 排名。无 targets 不改变 baseline worksheet/root calculation status。

`improvement_ratio.ratio` 表示相对 baseline 的缩减比例。`appliesTo: sigma` 时：

$$
\sigma_{new}=\sigma_{baseline}(1-ratio)
$$

`appliesTo: tolerance_band` 时保持原 tolerance band center：

$$
c=\frac{U+L}{2},\qquad h=\frac{U-L}{2}
$$

$$
U_{new}=c+h(1-ratio),\qquad L_{new}=c-h(1-ratio)
$$

该规则同样适用于非对称 upper/lower tolerance，并禁止改变 band center。

### 7.5 Optimization Result V2 根合同

```ts
type InputDecision =
  | { outcome: "NOT_PROVIDED"; artifactReference?: never; reasonCode?: never }
  | { outcome: "CONFIRMED" | "CALLER_AUTHORIZED"; artifactReference: ArtifactReference; reasonCode?: never }
  | { outcome: "DECLINED"; artifactReference: ArtifactReference; reasonCode: "user_declined" }
  | { outcome: "REJECTED"; artifactReference?: ArtifactReference; inputReferenceHash: string; reasonCode: "schema_invalid" | "identity_mismatch" | "unit_mismatch" | "path_invalid" };

type F6OptimizationWorksheetV2 = {
  worksheetName: string;
  tableId: string;
  runStatus: "COMPLETED" | "PARTIALLY_COMPLETED" | "INPUT_REJECTED";
  baselineIdentity: BaselineIdentity;
  baselineMetrics: F6Metrics;
  targetCapability: { targetCpk: number; targetSigmaLevel: number; source: "WORKSHEET" | "CONTROLLED_DEFAULT" };
  options: F6OptionV2[];
  highestImpactAction: { optionId: string; impactRank: number } | null;
  findings: F6InputFinding[];
  risks: F6Risk[];
  recommendations: F6Recommendation[];
  clarifications: F6Clarification[];
};

type F6OptimizationResultV2 = {
  contractVersion: "v1";
  outputClassification: "confidential";
  featureId: "F6";
  optimizationVersion: "f6-optimization-v2";
  runStatus: "COMPLETED" | "PARTIALLY_COMPLETED" | "INPUT_REJECTED";
  workbook: WorkbookIdentity;
  provenance: {
    f2Reference: ArtifactReference;
    f3Reference: ArtifactReference;
    f4Reference: ArtifactReference;
    f5Reference: ArtifactReference;
    imageObservationReference?: ArtifactReference;
    supplierCapabilityDecision: InputDecision;
    datumStrategyDecision: InputDecision;
    costDecision: InputDecision;
    analysisContextDecision: InputDecision;
    optimizationTargetsDecision: InputDecision;
  };
  worksheets: F6OptimizationWorksheetV2[];
  summary: {
    worksheetCount: number;
    completedWorksheetCount: number;
    partiallyCompletedWorksheetCount: number;
    inputRejectedWorksheetCount: number;
    candidateOptionCount: number;
    completedOptionCount: number;
    insufficientEvidenceOptionCount: number;
    calculationFailedOptionCount: number;
  };
};
```

Operational `runStatus` 与工程四态判定分离：candidate-only worksheet 可以是 `COMPLETED`，因为 baseline 分析已完成；有合法 target 但部分 scenario failed 时为 `PARTIALLY_COMPLETED`；baseline 输入/身份失败时为 `INPUT_REJECTED`。Root 按 worksheet operational status 聚合。现有固定四个 What-If option kind、固定 option 数量和 v1 summary 字段全部删除。

`F6InputFinding`、`F6Risk`、`F6Recommendation`、`F6Clarification` 延续现有严格结构，但 evidence references 必须接受新增 Context/Targets provenance。Recommendation 只能引用 `completed` 且 feasibility-supported option；candidate、declined/rejected input 和 calculation_failed option 只能形成 clarification/evidence closure。

## 8. TA Analysis Context 输入合同

```ts
type F6AnalysisContext = {
  contractVersion: "v1";
  inputClassification: "confidential";
  contextVersion: "f6-analysis-context-v1";
  workbookContentHash: string;
  projectName?: string;
  worksheets: Array<{
    worksheetName: string;
    tableId: string;
    baselineIdentity: BaselineIdentity;
    analysisObject?: {
      kind: "GAP" | "STEP" | "INTERFERENCE" | "ALIGNMENT" | "POSITION" | "CLEARANCE" | "COMPRESSION" | "ENGAGEMENT" | "FUNCTIONAL_DIMENSION";
      name: string;
      physicalMeaning: string;
      measurementDirection: string;
      positiveDirectionDefinition: string;
      negativeDirectionDefinition: string;
      evidence: EvidenceLocator;
    };
    functionalRequirements?: {
      requirementIds: string[];
      functionalBoundary?: string;
      passFailCriteria?: string;
      evidence: EvidenceLocator[];
    };
    operatingConditions: Array<{
      conditionId: string;
      category: "ASSEMBLY" | "LOAD" | "TEMPERATURE" | "STATIC_DYNAMIC" | "USE" | "IMPACT" | "TEST" | "FEA" | "MATERIAL_CONSTRAINT";
      description: string;
      evidence: EvidenceLocator;
    }>;
    correlationRequirement:
      | { mode: "INDEPENDENT"; evidence: EvidenceLocator }
      | { mode: "CORRELATED"; covarianceMatrixEvidence: EvidenceLocator }
      | { mode: "NOT_PROVIDED" };
    loopDefinition?: {
      start: string;
      end: string;
      responseDirection: string;
      factors: Array<{ factor: FactorIdentity; sign: 1 | -1 }>;
      evidence: EvidenceLocator[];
    };
  }>;
};

type EvidenceLocator = {
  artifactReference: ArtifactReference;
  worksheetName: string;
  sourceRows: SourceRowReference[];
};
```

CLI 与 Skill 新增 `--analysis-context <artifact-path>`。Context 必须 contained、non-linked、regular JSON，并与当前 workbook、worksheet、table 和 F4 baseline identity 匹配。每个 EvidenceLocator 必须绑定 containing worksheet，source rows 必须存在于当前 F2/F3/F4 scope。Loop factor 必须完整匹配当前 F4 FactorIdentity。缺少 context 不阻止 baseline 计算，但对应字段显示“未提供”并按影响生成 P0/P1/P2。Renderer 和 builder 禁止以 toleranceLoopDescription、worksheet name 或 image text 代替该工件。

Skill 模式必须在 targets 确认之前单独展示 Analysis Context 预览，包括 analysis object、方向、Loop signs、工况、功能边界和 correlation mode，并通过独立 `vscode_askQuestions` 取得 `Confirm analysis context`。拒绝时不使用该 context，继续缺口模式；不得把拒绝内容作为推断来源。直接 CLI/app CLI 显式传入 `--analysis-context` 视为 `CALLER_AUTHORIZED`。

Analysis Context 与 Optimization Targets 的决策结果分别记录到 Optimization result、run summary 和 manifest provenance，使用 `NOT_PROVIDED / CONFIRMED / CALLER_AUTHORIZED / DECLINED / REJECTED`。Schema/identity/path 失败为 `REJECTED`；用户拒绝为 `DECLINED`；两者不得折叠为 `NOT_PROVIDED`。后续 scenario calculation failure 记录在 option，不改变已确认输入的 decision outcome。

`REJECTED` 输入可能在文件 hash 可用前失败。此时不生成伪 artifact reference，只记录规范化路径参数的 SHA-256 `inputReferenceHash`；该 hash 不允许恢复或展示原始绝对路径。若文件已安全读取并计算内容 hash，可同时记录 artifactReference。

当前 F4 `excel-ta-v1` 只支持独立一维 RSS，不支持 covariance matrix。Analysis Context 的 `CORRELATED` 模式用于明确项目要求；即使 covariance evidence 存在，本期也不得用独立 RSS 替代相关模型，必须生成 P0 `correlated_model_not_supported`，将 worksheet 最终状态置为 INCOMPLETE，并保留已有 baseline 数值为“非适用参考、不得判定”。本设计不扩展 F4 covariance kernel；相关计算属于后续独立设计。

## 9. Composed Report V2 顶层合同

```ts
type F6ComposedEngineeringReportV2 = {
  contractVersion: "v1";
  outputClassification: "confidential";
  reportVersion: "f6-composed-report-v2";
  workbook: WorkbookIdentity;
  overallStatus: EngineeringDecisionStatus;
  workbookSummary: WorkbookSummary;
  blockedWorksheets: BlockedWorksheet[];
  worksheets: EngineeringWorksheetReport[];
};

type EngineeringDecisionStatus =
  | "PASS"
  | "CONDITIONAL_PASS"
  | "FAIL"
  | "INCOMPLETE";
```

具体结构类型：

```ts
type WorkbookIdentity = { fileName: string; contentHash: string };
type ArtifactReference = { artifact: string; contentHash: string };
type SourceRowReference = { worksheetName: string; tableId: string; sourceRow: number };
type FormulaReference = { outputField: string; formulaId: string; formulaVersion: string };
type SectionId = keyof EngineeringSections;

type WorkbookSummary = {
  scope: { selectedWorksheetNames: string[]; excludedWorksheetNames: string[] };
  worksheetStatuses: Array<{ worksheetName: string; status: EngineeringDecisionStatus }>;
  worstSupportedFinding?: { worksheetName: string; baselineDecision: "PASS" | "FAIL" | "NOT_COMPUTABLE"; reason: string };
  blockingGapCount: number;
  actionRequired: boolean;
};

type BlockedWorksheet = {
  worksheetName: string;
  status: "INCOMPLETE";
  reasons: string[];
  dataGaps: DataGap[];
  evidenceReferences: ArtifactReference[];
};

type EngineeringWorksheetReport = {
  worksheetName: string;
  tableId: string;
  status: EngineeringDecisionStatus;
  baselineDecision: "PASS" | "FAIL" | "NOT_COMPUTABLE";
  dataGaps: DataGap[];
  decisionInputs: {
    blockingP0GapIds: string[];
    conditionalP1GapIds: string[];
    supportedFailureEvidenceIds: string[];
    openHighRiskIds: string[];
  };
  sections: EngineeringSections;
  evidenceIndex: ReportEvidence[];
};
```

Blocked worksheet 不生成 16 章伪数值报告，只进入 `blockedWorksheets`。在本次 F1/F2 scope 内存在 blocked worksheet 时，workbook overall status 为 `INCOMPLETE`；未被用户选择的 worksheet 只列入 excluded scope，不影响状态。

状态算法先计算并保留 `baselineDecision`，再计算最终状态：

```text
if 存在影响当前最终判定的 P0:
  status = INCOMPLETE
else if baselineDecision == FAIL 或存在 confirmed requirement violation/负 Margin:
  status = FAIL
else if 存在 P1、预测性能力限制、open High/Critical risk 或部分完成:
  status = CONDITIONAL_PASS
else:
  status = PASS
```

因此 P0 + 可靠 baseline FAIL 的最终状态是 `INCOMPLETE`，但 `baselineDecision: FAIL` 和全部失败证据必须保留在第 1、8、9、12、16 章。P1 可以把 PASS 降为 CONDITIONAL_PASS，但永远不覆盖 FAIL；P2 不改变状态。Workbook overall 按 `PASS < CONDITIONAL_PASS < FAIL < INCOMPLETE` 聚合。

Schema `superRefine` 强制以下不变量：

- `blockingP0GapIds` 必须恰好等于 canonical `dataGaps` 中全部 P0 gap IDs。
- `conditionalP1GapIds` 必须恰好等于全部影响条件性判定的 P1 gap IDs；P2 不得进入 decisionInputs。
- `sections.dataGaps.gaps` 必须与 root `dataGaps` 内容和顺序完全一致，章节不是第二数据源。
- `supportedFailureEvidenceIds` 必须引用 evidenceIndex 中 HIGH/MEDIUM、SUPPORTED 且 `affectsFinalDecision: true` 的失败证据。
- `ReportEvidence.affectsFinalDecision: true` 只允许 HIGH/MEDIUM 的 INPUT_FACT/CALCULATED/DERIVED，或 MISSING 对应的 P0 gap；LOW、ASSUMPTION、INFERENCE 禁止。
- 有 blocking P0 时 status 必须为 INCOMPLETE；无 P0 且有 supported failure 时必须为 FAIL；无二者但有 conditional P1/open High risk 时必须为 CONDITIONAL_PASS；否则为 PASS。
- BlockedWorksheet 的全部 dataGaps 必须是 P0，status 固定 INCOMPLETE。

## 10. 通用证据模型

```ts
type ReportEvidence = {
  evidenceId: string;
  evidenceType:
    | "INPUT_FACT"
    | "CALCULATED"
    | "DERIVED"
    | "ASSUMPTION"
    | "INFERENCE"
    | "MISSING";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NOT_ASSESSED";
  status:
    | "SUPPORTED"
    | "NEEDS_REVIEW"
    | "INSUFFICIENT_EVIDENCE"
    | "NOT_EVALUATED";
  description: string;
  artifactReferences: ArtifactReference[];
  sourceRows: SourceRowReference[];
  formulaReferences: FormulaReference[];
  affectsFinalDecision: boolean;
  limitations: string[];
};
```

规则：

- `INPUT_FACT` 和 `CALCULATED` 在身份与 trace 完整时可为 HIGH。
- `DERIVED` 必须引用全部输入与公式，最高 HIGH。
- `ASSUMPTION` 最高 MEDIUM，必须 `NEEDS_REVIEW`。
- `INFERENCE` 最高 MEDIUM；图片/文字上下文推断按既有门禁通常为 LOW 或 MEDIUM。
- `MISSING` 为 `INSUFFICIENT_EVIDENCE`。
- LOW confidence 不得参与最终四态判定，不得生成具体公差变更建议。
- `SIGNAL`、`OPTION` 等 F5/F6 原始分类保留在 source classification 中，但联合报告统一映射到上述证据类型，不改变原始语义。

## 11. 公式复核模型

```ts
type FormulaCheck = {
  outputField: string;
  formulaId: string;
  formulaVersion: "excel-ta-v1";
  expression: string;
  inputs: Array<{
    name: string;
    value: number;
    unit: string;
    source: string;
  }>;
  result: {
    value: number;
    unit: string;
  };
  sourceCells: string[];
  recomputable: true;
};
```

表达式来自受控 `formulaId` 字典，不从模型自由生成：

$$
\mu = \sum_i \mu_i + \Delta\mu
$$

$$
WC_{upper}=\sum_i U_i,\qquad WC_{lower}=\sum_i L_i
$$

$$
\sigma_{RSS}=\sqrt{\sum_i \sigma_i^2}
$$

$$
Contribution_i=\frac{\sigma_i^2}{\sigma_{RSS}^2}\times100\%
$$

$$
Cp=\frac{USL-LSL}{6\sigma}
$$

$$
Cpk_L=\frac{\mu-LSL}{3\sigma},\qquad
Cpk_U=\frac{USL-\mu}{3\sigma}
$$

$$
Cpk=\min(Cpk_L,Cpk_U)
$$

F6 中新增纯函数 report projection adapter。它只能：

- 复制 F4 baseline 数值和 trace。
- 从受控 `formulaId -> expression` registry 构造 FormulaCheck。
- 使用 F4 Mean/RSS/WC/specification 派生统计边界与 Margin。
- 计算 reported-vs-calculated difference 和格式化前的数值容差检查。

它不得重算或替换 F4 Mean、RSS、WC、Cp/Cpk、Z、DPM、Yield。Renderer 不做任何工程计算。Builder 必须从 F4 `traceRecords` 查找 baseline output 的 formula ID 和 source cells；缺少最终判定所需 trace 是 P0，且对应 FormulaCheck 不能标记 `recomputable: true`。

Report-only derived fields 使用独立受控 formula IDs：`statistical-bound-v1`、`statistical-margin-v1`、`worst-case-margin-v1`、`self-check-difference-v1`，并引用其 F4 source FormulaReference。该 adapter 位于 workbook-catalog，具有独立单元测试，不属于 renderer。

## 12. Margin 模型

统计与 Worst Case 分开保存：

```ts
type MarginAssessment = {
  statistical: {
    sigmaLevel: number;
    lowerBound: number;
    upperBound: number;
    lowerMargin: number;
    upperMargin: number;
    minimumMargin: number;
    formulaReferences: FormulaReference[];
  };
  worstCase: {
    lowerBound: number;
    upperBound: number;
    lowerMargin: number;
    upperMargin: number;
    minimumMargin: number;
    formulaReferences: FormulaReference[];
  };
};
```

统计边界：

$$
Lower_n=\mu-n\sigma,\qquad Upper_n=\mu+n\sigma
$$

$$
LowerMargin=Lower_n-LSL
$$

$$
UpperMargin=USL-Upper_n
$$

$$
MinimumMargin=\min(LowerMargin,UpperMargin)
$$

Worst Case 使用 F4 `system.worstCaseLower/Upper`，不得从 RSS 反推。

## 13. 能力语义

```ts
type CapabilityBasis =
  | "PREDICTIVE_TOLERANCE_MODEL"
  | "MEASURED_PROCESS_DATA";
```

当前 F4/F5/F6 baseline 固定为 `PREDICTIVE_TOLERANCE_MODEL`。没有受控实测数据时：

- Cpk 必须显示为“预测性能力指标”。
- Yield/DPM 必须显示为“模型预测”。
- 预测 0 DPM 表述为“在当前模型及分布假设下，预测缺陷率接近 0 DPM”。
- 不得写成实际量产零缺陷。
- 实测量产能力缺失形成 P1 数据缺口，不自动覆盖受支持的设计 FAIL。

若 distribution 不是 normal，不输出正态 Yield/DPM 结论。若 Factor 独立性未经项目确认，RSS 显示为假设，confidence 为 MEDIUM；若输入明确要求相关模型但缺少 covariance matrix，则形成 P0。

## 14. 数据缺口模型

```ts
type DataGap =
  | {
      gapId: string;
      priority: "P0";
      blocksFinalDecision: true;
      missingInformation: string;
      affectedSections: SectionId[];
      suggestedSource: string;
      responsibleRole: string;
      verificationMethod: string;
      evidenceReferences: ArtifactReference[];
    }
  | {
      gapId: string;
      priority: "P1" | "P2";
      blocksFinalDecision: false;
      missingInformation: string;
      affectedSections: SectionId[];
      suggestedSource: string;
      responsibleRole: string;
      verificationMethod: string;
      evidenceReferences: ArtifactReference[];
    };
```

### 14.1 P0

影响计算正确性或最终 PASS/FAIL：

- 缺少 LSL/USL 或必要规格。
- Factor 数值、公差、单位或 distribution 无法用于计算。
- 必须依赖 Loop 方向才能验证但方向未提供。
- 必要 F4 formula trace 缺失或身份不一致。
- 项目明确要求相关模型但 covariance matrix 未提供。
- 输入之间存在会改变计算结果的矛盾。

### 14.2 P1

影响风险、优化或能力解释：

- 实测量产能力未提供。
- Supplier capability、datum strategy、cost 或 Optimization Targets 未提供。
- 载荷、温度、寿命、相关性等项目条件未确认，但不阻断当前 baseline 数学。
- 高风险 SIGNAL 未完成工程审核。

### 14.3 P2

影响追溯或报告完整性：

- Drawing Number、Part Number、非关键 Requirement ID 等治理字段缺失，且不改变当前计算。
- 补充图纸、测试说明或角色信息缺失。

## 15. 最终判定规则

```text
先保存 baselineDecision，再按第 9 节算法计算最终状态。P0 + FAIL 显示 `INCOMPLETE` 和 `baselineDecision: FAIL`；P1 只把 PASS 降为 CONDITIONAL_PASS；P2 不改变状态。
```

通用 Cpk 等级只作为说明。最终状态优先使用 worksheet/project target Cpk。LOW confidence、ASSUMPTION 和 INFERENCE 不得直接改变最终状态。

## 16. 联合报告固定 16 章

每个 ready worksheet 严格包含以下 section，JSON 使用具名字段，Markdown 使用中文标题：

```ts
type EngineeringSections = {
  executiveSummary: ExecutiveSummarySection;
  objectiveAndRequirements: ObjectiveSection;
  operatingConditions: OperatingConditionsSection;
  inputIntegrity: InputIntegritySection;
  toleranceLoopDefinition: LoopDefinitionSection;
  calculationSelfCheck: SelfCheckSection;
  statisticalResults: StatisticalResultsSection;
  specificationAndMargins: MarginSection;
  capabilityAssessment: CapabilitySection;
  contributorAnalysis: ContributorSection;
  sensitivityAndOptimization: OptimizationSection;
  riskAssessment: RiskSection;
  engineeringRecommendations: RecommendationSection;
  designIntentReview: DesignIntentSection;
  dataGaps: DataGapSection;
  finalConclusion: FinalConclusionSection;
};

type SectionStatus = "SUPPORTED" | "PARTIAL" | "INSUFFICIENT_EVIDENCE" | "NOT_APPLICABLE";
type SectionBase<Id extends string> = { sectionId: Id; status: SectionStatus; evidenceIds: string[] };
type Quantity = { value: number; unit: string };
type RangeQuantity = { lower: number; upper: number; unit: string };
type AnalysisObject = {
  kind: "GAP" | "STEP" | "INTERFERENCE" | "ALIGNMENT" | "POSITION" | "CLEARANCE" | "COMPRESSION" | "ENGAGEMENT" | "FUNCTIONAL_DIMENSION";
  name: string;
  physicalMeaning: string;
  measurementDirection: string;
  positiveDirectionDefinition: string;
  negativeDirectionDefinition: string;
};
type OperatingCondition = { conditionId: string; category: string; description: string; evidenceId: string };
type InputFactorRow = {
  factor: FactorIdentity;
  partName: string | null;
  drawingNumber: string | null;
  dimId: string | null;
  nominal: Quantity;
  mean: Quantity;
  upperTolerance: Quantity;
  lowerTolerance: Quantity;
  distribution: string;
  sigmaLevel: number;
  sigma: Quantity;
  longTermSafetyFactor: number;
  sourceCells: Record<string, string>;
  evidenceId: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NOT_ASSESSED";
  notes: string[];
};
type IntegrityFinding = { findingId: string; field: string; status: "VALID" | "MISSING" | "CONFLICT" | "NOT_APPLICABLE"; message: string; gapId: string | null };
type LoopTerm = { factor: FactorIdentity; sign: 1 | -1; physicalMeaning: string | null; evidenceId: string };
type ConsistencyCheck = {
  checkId: string;
  calculated: Quantity;
  reported: Quantity;
  difference: Quantity;
  tolerance: Quantity;
  toleranceBasis: string;
  result: "PASS" | "FAIL" | "INCOMPLETE";
  formulaCheckIds: string[];
};
type StatisticalRange = { sigmaLevel: number; range: RangeQuantity; formulaCheckId: string };
type Specification = { target: Quantity; lsl: Quantity; usl: Quantity; targetCpk: number };
type ContributorRow = { rank: number; factor: FactorIdentity; sigma: Quantity; contributionPercent: number; cumulativePercent: number; evidenceId: string; confidence: "HIGH" | "MEDIUM" | "LOW" | "NOT_ASSESSED" };
type SensitivityRow = { factor: FactorIdentity; responseCoefficient: number | null; directionStatement: string; evidenceId: string; reviewRequired: boolean };
type OptimizationTargetSummary = { targetId: string; targetType: string; factor: FactorIdentity | null; targetValue: Quantity | number; evidenceId: string };
type RiskRow = { riskId: string; category: string; rating: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"; trigger: string; evidenceIds: string[]; confidence: "HIGH" | "MEDIUM" | "LOW" | "NOT_ASSESSED"; currentMargin: Quantity | null; verificationMethod: string };
type ActionRow = { actionId: string; targetFactor: FactorIdentity | null; targetRiskId: string | null; rationale: string; quantifiedBenefit: string | null; validationRequired: string; sideEffects: string[]; evidenceIds: string[] };
type DesignIntentCheck = { checkId: string; topic: string; status: "SUPPORTED" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE" | "NOT_APPLICABLE"; finding: string; evidenceIds: string[]; gapId: string | null };

type ExecutiveSummarySection = SectionBase<"executive_summary"> & { analysisObject: string | null; mean: Quantity | null; rssSigma: Quantity | null; statisticalRange: RangeQuantity | null; worstCaseRange: RangeQuantity | null; minimumMargin: Quantity | null; predictiveCpk: number | null; topContributors: ContributorRow[]; primaryRisks: string[]; decision: EngineeringDecisionStatus; actionRequired: boolean };
type ObjectiveSection = SectionBase<"objective_and_requirements"> & { analysisObject: AnalysisObject | null; target: Quantity | null; lsl: Quantity | null; usl: Quantity | null; targetCpk: number | null; requirementIds: string[]; functionalBoundary: string | null; passFailCriteria: string | null };
type OperatingConditionsSection = SectionBase<"operating_conditions"> & { conditions: OperatingCondition[] };
type InputIntegritySection = SectionBase<"input_integrity"> & { rating: "COMPLETE" | "PARTIALLY_COMPLETE" | "INSUFFICIENT"; factors: InputFactorRow[]; findings: IntegrityFinding[] };
type LoopDefinitionSection = SectionBase<"tolerance_loop_definition"> & { start: string | null; end: string | null; responseDirection: string | null; terms: LoopTerm[]; equation: string | null; reviewRequired: boolean };
type SelfCheckSection = SectionBase<"calculation_self_check"> & { meanCheck: ConsistencyCheck | null; rssCheck: ConsistencyCheck | null; rangeChecks: ConsistencyCheck[]; worstCaseCheck: ConsistencyCheck | null };
type StatisticalResultsSection = SectionBase<"statistical_results"> & { mean: Quantity; adjustedMean: Quantity; meanShift: Quantity; rssSigma: Quantity; ranges: StatisticalRange[]; worstCase: RangeQuantity; formulaChecks: FormulaCheck[] };
type MarginSection = SectionBase<"specification_and_margins"> & { specification: Specification; assessment: MarginAssessment; interferenceStatus: "PRESENT" | "ABSENT" | "UNKNOWN" };
type CapabilitySection = SectionBase<"capability_assessment"> & { basis: CapabilityBasis; cp: number; lowerCpk: number; upperCpk: number; cpk: number; lowerZ: number | null; upperZ: number | null; predictedDpm: number | null; predictedYield: number | null; targetCpk: number; result: "PASS" | "FAIL"; limitations: string[] };
type ContributorSection = SectionBase<"contributor_analysis"> & { contributors: ContributorRow[]; interpretationLimit: string };
type OptimizationSection = SectionBase<"sensitivity_and_optimization"> & { sensitivities: SensitivityRow[]; targets: OptimizationTargetSummary[]; options: F6OptionV2[]; highestImpactAction: string | null; roiStatus: "COMPUTED" | "NOT_COMPUTED" };
type RiskSection = SectionBase<"risk_assessment"> & { risks: RiskRow[] };
type RecommendationSection = SectionBase<"engineering_recommendations"> & { mandatoryActions: ActionRow[]; validationActions: ActionRow[]; conditionalOptimizations: ActionRow[] };
type DesignIntentSection = SectionBase<"design_intent_review"> & { checks: DesignIntentCheck[] };
type DataGapSection = SectionBase<"data_gaps"> & { gaps: DataGap[] };
type FinalConclusionSection = SectionBase<"final_conclusion"> & { summary: string; decision: EngineeringDecisionStatus; basis: string[]; limitations: string[]; nextActions: string[]; baselineDecision: "PASS" | "FAIL" | "NOT_COMPUTABLE" };
```

所有上述类型在 contracts 中实现为 strict object；`sourceCells` 是唯一允许的受限 string record。字段无证据时使用 nullable value 加对应 DataGap，不使用 `unknown`、自由 `z.record` 或自由文本占位替代机器字段。

1. 执行摘要 Executive Summary
2. 分析目标与功能要求
3. 分析工况与适用边界
4. 输入数据与完整性检查
5. 公差链定义 Tolerance Loop Definition
6. Loop 一致性与计算自检
7. 统计分析结果
8. 规格符合性与 Margin 评估
9. 制程能力评估 Capability Assessment
10. 变异贡献分析 Contributor Analysis
11. 敏感度与优化收益分析
12. 风险评估
13. 工程建议
14. 设计意图审查 Design Intent Review
15. 数据缺口与待确认事项
16. 最终结论

### 16.1 第 1 章

先展示分析对象、目标、Mean、RSS 1σ、统计范围、WC、Minimum Margin、预测 Cpk、Top Contributors、主要风险、最终四态和是否需要行动。缺失字段明确显示“未提供”。

### 16.2 第 2 章

展示 CTQ、Target、LSL、USL、Target Cpk、Requirement/DIM identity。分析对象类型只接受结构化输入，未提供时不得从描述词或图片推断。

### 16.3 第 3 章

只展示明确输入的装配、载荷、温度、静态/动态、测试、FEA、材料或约束条件。没有输入时列数据缺口，不把 Deflection 等字段扩展为跌落或冲击工况。

### 16.4 第 4 章

展示全部 Factor：ID、描述、Part、Drawing Number、DIM ID、Nominal/Mean、公差、distribution、σ level、1σ、LTSF、unit、source、evidence、confidence 和备注。输出完整性评级 `Complete / Partially Complete / Insufficient`。

### 16.5 第 5 章

展示 Loop 起点、终点、闭合路径、响应方向和 Factor 方向。只有结构化方向证据完整时生成：

$$
Response=s_1X_1+s_2X_2+\cdots+s_nX_n
$$

否则显示“Loop方向待工程师确认”，并形成相应 P0/P1（由其是否影响当前计算验证决定）。

### 16.6 第 6 章

展示 Mean、σ、范围和 WC 自检：calculated、reported、difference、tolerance basis、PASS/FAIL。判定容差来自受控数值策略和输入精度；没有明确项目标准时，使用输入最小有效分辨率并标为 ASSUMPTION。

### 16.7 第 7 章

展示 Mean、Adjusted Mean、Mean Shift、1σ、1σ/3σ/4σ/6σ范围（适用时）、WC lower/upper。所有值带单位并关联 FormulaCheck。

### 16.8 第 8 章

分别展示统计 Margin 和 Worst Case Margin，不以 RSS PASS 推导 WC PASS。

### 16.9 第 9 章

展示 Cp、Lower/Upper/Overall Cpk、Z、预测 DPM/Yield、Target Cpk、PASS/FAIL 和 `PREDICTIVE_TOLERANCE_MODEL` 限制。

### 16.10 第 10 章

展示全部 Factor，按 variance contribution 降序，包含累计贡献率、source 和 confidence。明确“高贡献率不等于根因或超差”。

### 16.11 第 11 章

展示线性敏感度和受控目标模拟。无 Optimization Targets 时只显示候选 Factor、required inputs 和计算方法，不显示虚构收益。组合方案必须经 F4 kernel 完整重算，不能叠加单因子百分比。

### 16.12 第 12 章

每项风险包含等级 `Low / Medium / High / Unknown`、触发条件、证据、可信度、当前 Margin 和建议验证。证据不足使用 `Unknown`。

### 16.13 第 13 章

分为“当前必须行动”“建议验证”“条件性优化”。具体公差变更只允许引用有效 Optimization Targets 和重算结果。

### 16.14 第 14 章

评估 Margin、过度设计、低贡献公差、CTQ/KPC、DIM ID、Control Plan、实测能力和图纸/接口/检验规范。无数据时仅形成验证建议。

### 16.15 第 15 章

按 P0、P1、P2 排序，显示影响范围、是否阻断、数据来源、责任角色和验证方法。

### 16.16 第 16 章

输出一段可用于设计评审的中文结论，并提供：

- 最终判定。
- 判定依据。
- 关键限制。
- 下一步行动。

结论必须与正文数值、风险和数据缺口一致。

## 17. 章节字段来源与缺失行为

| 章节 | 关键结构化字段 | 来源 | 缺失行为 |
|---|---|---|---|
| 1 | object、mean、rss、WC、margin、Cpk、top factors、status、actionRequired | Context/F4/F5/F6 | 按依赖形成 P0/P1/P2 |
| 2 | analysisObject、Target、LSL/USL、Target Cpk、requirement IDs | Context/F2/F4 | 对象未提供 P2；规格缺失 P0 |
| 3 | operatingConditions[] | Analysis Context | 未提供为 P1，不推断 |
| 4 | factor rows、units、distribution、trace、completeness | F2/F3/F4 | 计算字段缺失 P0；治理字段通常 P2 |
| 5 | start/end/direction/signs/equation | Analysis Context + F5 image evidence | 影响闭合验证时 P0，否则 P1 |
| 6 | mean/rss/WC checks、difference、tolerance basis | F4 + projection adapter | trace/关键输入缺失 P0 |
| 7 | mean、shift、nσ ranges、WC | F4 + projection adapter | 数值不可计算 P0 |
| 8 | statistical/WC margins | F4 + projection adapter | 规格或单位缺失 P0 |
| 9 | capabilityBasis、Cp/Cpk/Z/DPM/Yield | F4/F5 | 非 normal 时 DPM/Yield NOT_APPLICABLE |
| 10 | all contributors、cumulative contribution | F4/F5 | RSS 不适用时 NOT_APPLICABLE |
| 11 | sensitivities、targets、scenarios、candidate factors | F4/Targets/F6 | targets 缺失 P1，不量化 |
| 12 | risk rows | F5 SIGNAL/F6 risk/evidence | 无证据用 Unknown/P1 |
| 13 | mandatory/validation/conditional actions | Supported findings/gaps/options | 无证据禁止具体变更 |
| 14 | margin/overdesign/CTQ/KPC/control plan review | Context/F2-F6 | 缺失项 P1/P2，不猜测 |
| 15 | ordered DataGap[] | 全部输入 | 必须完整列出 |
| 16 | decision、basis、limitations、actions | 前 15 章 | 与状态算法一致 |

`Target` 来自 F4 designNominal；分析对象、工况、功能边界、KPC/Control Plan 等仅来自 Analysis Context 或现有明确结构化字段。Self-check tolerance basis 使用项目 Context 提供的标准；未提供时可用输入最小有效分辨率作为显式 MEDIUM confidence ASSUMPTION，若该容差将改变最终判定则形成 P0 并要求确认。

## 18. 独立 F5/F6 Markdown

### 18.1 F5

保留五章 ownership，统一中文标题、状态、证据标签、confidence、source 和 limitations。不得输出 F6 ranking、ROI、量化优化收益或最终设计推荐。

### 18.2 F6 Optimization

分为：

- Baseline。
- Optimization Targets。
- Scenario recalculation。
- RSS/WC/Margin/Cpk comparison。
- Feasibility。
- Cost/ROI。
- Evidence gaps。

无 Optimization Targets 时不生成默认比例场景。

## 19. 精度与单位策略

- JSON 保存有限数值原值，不通过字符串格式化改变计算结果。
- Markdown 精度与输入有效精度对齐。
- 默认显示精度不得高于最细输入精度加一个 guard digit。
- 百分比和 ppm 采用受控格式化策略，避免长浮点尾数。
- 每个工程数值必须有单位；ratio、Cpk、Cp、Yield 等无量纲值明确标注 `ratio` 或 `%`。
- 单位不一致时不自动换算；形成 P0 或拒绝输入。

## 20. 错误处理与降级

- Optimization Targets 路径、schema、identity、unit 任一失败：拒绝整个可选工件并按调用模式 fail closed，不部分接受。
- Analysis Context 路径、schema、identity 任一失败：拒绝整个可选工件，不部分接受。
- 缺少 Optimization Targets：F6 继续，但不生成量化 scenario。
- 缺少 supplier/datum evidence：相关 feasibility 为 `insufficient_evidence`。
- 缺少 cost：ROI 为 `not_computed`。
- 图片 observation 无法确认：保持 `NOT_EVALUATED` 或 `INSUFFICIENT_EVIDENCE`。
- 非 normal distribution：不输出正态 Yield/DPM。
- 实测数据缺失：能力基础保持 predictive。
- v1 existing artifact：返回 `unsupported_artifact_version`。
- 任一 baseline identity/hash/trace mismatch：停止，不展示不可信内容。
- F2 blocked worksheet 只进入 workbook input validation，不生成伪造的数值章节。

## 21. 安全与治理边界

- 全部工程输入和输出为 `confidential`。
- 源 workbook 只读。
- 不通过 error、log、child process 或 Markdown 泄漏绝对路径和原始敏感输入。
- Optional evidence 必须 contained、non-linked、regular file。
- Runner 继续 deterministic、network-free、atomic publish。
- ADO 只通过 F3 明确 publishing gate，报告升级不增加外部写入。
- 不接受模型自由文本作为计算参数。

## 22. 实施范围

### 22.1 Contracts

- `packages/contracts/src/contracts.ts`
- `packages/contracts/src/contracts.test.ts`

新增/替换 Optimization v2、Composed v2、Optimization Targets、Analysis Context、Evidence、FormulaCheck、Margin、DataGap、16 sections 和四态 schema。

### 22.2 Workbook Catalog

- `packages/workbook-catalog/src/f6-optimization.ts`
- `packages/workbook-catalog/src/f6-optimization.test.ts`
- `packages/workbook-catalog/src/f6-composed-report.ts`
- `packages/workbook-catalog/src/f6-composed-report.test.ts`

删除默认百分比 option，按 Optimization Targets 生成 option，构造 v2 联合报告。

新增受控 report projection adapter，负责 FormulaCheck、统计范围、自检差值和 Margin 派生。

### 22.3 Scripts 与 CLI

- `scripts/f6-artifact-loader.mjs`
- `scripts/f6-artifact-loader.test.mjs`
- `scripts/f6-cli-args.mjs`
- `scripts/f6-cli-args.test.mjs`
- `scripts/run-f6-full-validation.mjs`
- `scripts/f6-full-flow.test.mjs`
- `apps/cli/src/commands/feature6.ts`
- `apps/cli/src/commands/feature6.test.ts`
- `apps/cli/src/commands/feature6.security.test.ts`
- `apps/cli/src/index.ts`
- `apps/cli/src/index.test.ts`

新增 `--optimization-targets` 和 `--analysis-context`，验证 provenance、output hash、六文件原子发布和安全边界。

### 22.4 Renderers

- `scripts/f5-report.mjs`
- `scripts/f5-report.test.mjs`
- `scripts/f6-report.mjs`
- `scripts/f6-report.test.mjs`
- `scripts/f6-composed-report.mjs`
- `scripts/f6-composed-report.test.mjs`

### 22.5 Skill 与治理文档

- `.github/skills/f6-analysis/SKILL.md`
- `scripts/f6-skill.test.mjs`
- `README.md`
- `docs/02-end-to-end-flow.md`
- `docs/02-端到端流程.md`
- `docs/governance/feature-register.md`

F6 Skill W8/W9 必须按以下顺序编排：

1. 收集并验证可选 Analysis Context。
2. 若存在，展示完整 Context preview，单独询问 `Confirm analysis context`；拒绝后记录 `DECLINED` 并继续缺口模式。
3. 收集并验证可选 Optimization Targets。
4. 若存在，展示完整 Targets preview，单独询问 `Confirm optimization targets`；拒绝后记录 `DECLINED` 并继续 candidate-only 模式。
5. Context 和 Targets 两次确认不得合并，也不得与 F3 ADO 写入确认合并。
6. 只有 confirmed targets 可追加到 W9 F6 命令；confirmed context 可独立使用，不要求 targets 同时存在。
7. Preview 或确认前不得执行 scenario calculation。
8. F6 ledger 展示 Context/Targets 的 `NOT_PROVIDED / CONFIRMED / DECLINED / REJECTED` outcome 和受控 hash，不展示绝对路径。

### 22.6 Governance Registry

- `packages/governance/src/feature-register.ts`
- `packages/governance/src/policy-gate.test.ts`
- 受 `f6-composed-report-check`、`f6-skill-contract-check` 和 full-flow acceptance 约束的相关测试。

治理 registry 必须登记 v2 optimization/composed、Optimization Targets 和 Analysis Context contract IDs，移除当前 F6 v1 作为可用 artifact 的声明，并保留 v1 only 的受控 unsupported-version 行为。

## 23. 测试策略

### 23.1 Contract

- v2 strict schemas 接受完整合法工件。
- v1 被当前 v2 schema 拒绝。
- 四态、16 章、Evidence、FormulaCheck、Margin、DataGap 均 fail closed。
- LOW/ASSUMPTION/INFERENCE 不得驱动最终状态。
- 16 个 section 的 strict fields、evidenceIds、nullable/missing 配对规则通过。

### 23.2 Optimization

- 无 target 不产生量化场景。
- Factor tolerance、Factor sigma、ratio、system target 均经 F4 kernel 重算。
- 重复、越界、单位不一致、identity mismatch 拒绝整个 targets 工件。
- 组合收益不允许直接相加。
- 空 system target、重复 targetId、错误 baselineIdentity 被拒绝。

### 23.3 Analysis Context

- 只接受结构化 enum 和 identity-bound context。
- Context 缺失时不从 worksheet/description/image 推断 object 或 conditions。
- Loop signs 只有完整绑定时生成 equation。
- Correlated 模式缺 covariance evidence 形成 P0。

### 23.4 Composed Builder

- RSS、WC、统计 Margin、WC Margin 分开。
- Predictive capability 与 measured capability 分开。
- P0 覆盖状态，P1/P2 不覆盖可靠 FAIL。
- 全部 Factor contribution 排序与累计值正确。
- 多 worksheet 不跨 CTQ 聚合数值。
- P0 + baseline FAIL 保留 baselineDecision FAIL，最终为 INCOMPLETE。
- In-scope blocked worksheet 使 workbook overall INCOMPLETE；excluded scope 不影响状态。

### 23.5 Renderer

- 中文 16 章顺序固定。
- 关键数字带单位且没有长浮点尾数。
- FormulaCheck 可复核。
- 缺失项显示“未提供/无法确认”。
- 不出现旧英文十章标题。
- 不把预测指标写成实测指标。
- 不把 contributor 写成根因。

### 23.6 Full Flow 与 Security

- 六文件、manifest、hash、atomic publish 正确。
- `--optimization-targets` provenance 正确。
- `--analysis-context` provenance 正确。
- Path traversal、symlink、classification、polluted child process、invalid JSON、multiple JSON 均 fail closed。
- Existing v1 artifact 返回受控版本错误。

### 23.7 Real Workbook Regression

- Mean、RSS、WC、Cp/Cpk、DPM/Yield 与 F4 原值一致。
- 无 targets 时不得出现默认 -20%/-30% 场景。
- 当前样例缺少的 Drawing Number/Part Number 按影响分配 P1/P2，不凭空补全。
- Loop 方向无结构化证据时显示待确认。

### 23.8 Skill Governance

- 断言 Context preview/confirmation 在 Targets preview/confirmation 之前，且都在 F6 invocation 之前。
- 断言两个确认调用独立，exact choices 分别为 `Confirm analysis context` 和 `Confirm optimization targets`。
- 断言 Context declined 时不传 `--analysis-context`，Targets declined 时不传 `--optimization-targets`。
- 断言未确认 targets 时禁止量化 scenario。
- 断言 direct CLI 的两个显式 flags 记录 `CALLER_AUTHORIZED`，Skill 确认记录 `CONFIRMED`。
- 断言 `NOT_PROVIDED / DECLINED / REJECTED / CONFIRMED / CALLER_AUTHORIZED` 在 run summary、manifest provenance 和 Optimization result 中保持一致。
- 断言 scenario calculation failure 只改变 option status，不改写已确认 input decision。
- 断言对 Context/Targets 的确认不是最终设计变更批准，报告不得声称 recommendation 已获工程批准。

## 24. 验收标准

1. 全部 F5/F6 新旧相关测试按 v2 设计更新并通过。
2. `npm run build -- --force` 通过。
3. 全仓测试通过；已知并发测试如有环境性波动，必须串行复核。
4. F6 仍只发布六个同名文件。
5. 联合 Markdown 严格包含 16 章中文结构。
6. JSON `reportVersion` 为 `f6-composed-report-v2`，optimization 为 v2。
7. 无 Optimization Targets 时不产生量化收益。
8. 任一关键数值均可追溯到 F4 formula trace 或明确输入。
9. RSS、WC、Margin、预测能力清晰分离。
10. 最终四态与 P0/P1/P2、正文数值和风险一致。
11. 不出现无证据的供应商、材料、制程、工况、失效原因或改善收益判断。
12. Skill、README、中英文流程和 Feature Register 与实现一致。
13. Analysis Context 缺失时不发生任何分析对象、方向或工况文本推断。
14. Governance registry、policy gate、manifest 与 v2 contract IDs 一致。

## 25. 被替代设计声明

本设计替代 `2026-08-14-f6-optimization-and-composed-report-design.md` 中以下内容：

- `f6-optimization-v1` 和 `f6-composed-report-v1` 作为当前版本。
- 联合报告固定十章。
- 默认 Top 1 -20% 和 Top 3 -30% 场景。
- `PASS/RISK/FAIL` 三态联合报告。

以下内容继续有效：

- F5/F6 ownership。
- F4 kernel 为重算底座。
- Supplier/datum/cost evidence gate。
- ROI 缺证据时 `not_computed`。
- 六文件 atomic publish。
- Confidential、identity、hash 和 fail-closed 治理边界。
