# F0 内部制程公差指导库设计

**日期：**2026-07-28

## 目标

将 CNC、压铸、模切、PCB/FPC、注塑与钣金能力矩阵转换为受控的 F0 内部知识库，供
后续 F2 对 TA 分析表中每项公差进行只读筛查。该能力只判断公差是否超过适用制程的
**推荐最大公差**；不判断公差是否过紧、是否可制造，也不作供应商能力或工程可行性
结论。

## 已确认决策

- 六份能力矩阵及其派生规则分类为 `internal`。
- F2 可以读取内部规则，并在结果中返回命中规则的文件名、工作表和单元格范围。
- 未匹配时返回 `unknown`、`T0` 和固定提示 `制程能力未知，请与供应商确认`。
- 判定不包含 `too-tight`、`pass`、`fail`、`feasible` 或任何制造可行性断言。
- 现有匿名 `public/v1` 知识快照保持不变；内部能力库使用独立、显式的版本与 API。

## 当前治理冲突与前置条件

当前仓库不能直接提交这些原始工作簿：`.gitignore` 忽略 `.xlsx/.xlsm`，
`scripts/verify-repository.mjs` 会拒绝所有被追踪的 `.xlsx/.xlsm` 路径，而
`docs/governance/data-classification.md` 规定 Git 仅接受匿名 `public` fixture。

因此，在不先变更治理规则并获得相应审批前，原始内部文件必须存储在受访问控制的
外部内部文档库。仓库中只保存不含原文的来源元数据、SHA-256、版本、工作表和单元格
范围，以及审核后的内部规则快照。

如果业务坚持将原始工作簿提交到当前 Git 仓库，实施前必须完成以下独立审批和变更：

1. 在数据分类治理中明确允许指定目录中的 `internal` `.xlsx` 工件，并定义访问控制、
   审计、保留与撤销要求。
2. 将仓库验证器从全局禁止改为只允许一个受控白名单目录，且拒绝所有其他 Excel 文件。
3. 将 `.gitignore` 改为只对该白名单目录取消忽略。
4. 确认远端 Git 托管、克隆权限与 PR 审阅范围符合内部数据处理要求。

这些审批与治理调整不属于本 F0 功能实现本身。未完成前，任何导入器不得把原始
工作簿复制进仓库。

## 架构

```mermaid
flowchart LR
    SOURCE["内部能力矩阵 Excel\n受控文档库"] --> IMPORT["受控导入器"]
    IMPORT --> REVIEW["人工审核与单位归一化"]
    REVIEW --> SNAPSHOT["internal-v1 规则快照\nmanifest + SHA-256"]
    SNAPSHOT --> API["F0 内部公差指导查询 API"]
    API --> F2["F2 TA 公差筛查"]
    SOURCE -. 文件 hash、工作表、范围 .-> SNAPSHOT
```

导入器只在受控维护流程中运行，不在 F2 分析时解析 Excel。发布后的运行时查询仅读取
已验证、不可变的 `internal-v1` 快照。每次快照发布必须同时保存完整 manifest 和三类
证据：来源文件 SHA-256、工作表名称和单元格范围。

### 2026-07-28 已发布快照

审核已确认后，`internal-v1` 发布了 110 条 `T3` 指导规则，并逐条保留来源范围和六份
受控工作簿的 SHA-256：CNC 8 条、压铸 DCTG6 11 条、模切 20 条、PCB/FPC 23 条、注塑
TG6/NW 16 条、钣金成形件 class m（厚度不超过 10 mm）32 条。规则仍只回答“TA 总公差带
是否超过推荐最大带宽”。

审核中排除的内容保持未发布：最小特征/间隙限制、材料数据表厚度、GD&T 个案、非单一
`+/- mm` 表述、钣金厚度大于 10 mm，以及 PCB `around 1.60 mm` 的无可审计名义尺寸范围
候选。它们必须在具有明确匹配上下文和新的审核结论后才可加入后续快照。

## 数据边界

原始矩阵保留为证据，不作为 API 输入。导入后的规则必须具有稳定 ID，并表示单一、
可审核的适用情景：制程、特征类型、可选材料、名义尺寸区间和公差表示。不能从单一
矩阵行推断出未明确给出的材料、特征或尺寸覆盖范围。

所有比较在归一化后的总公差带上进行：双边 `$ \pm t $` 规范化为 `$ 2t $`；单边
公差使用上下偏差之差；原始表示与原始值同时保留在证据中。输入单位或规则单位不受
支持、缺失或歧义时必须返回 `unknown`，不得进行猜测转换。

### 内部能力规则

```ts
interface InternalToleranceGuidanceEntry {
  entryId: string;
  processFamily: "cnc-machining" | "die-casting" | "die-cutting" | "pcb-fpc" | "plastic-injection-molding" | "sheet-metal";
  featureType: string;
  material?: string;
  nominalRange?: {
    min: number;
    minInclusive?: boolean; // default true
    max: number;
    maxInclusive?: boolean; // default true
    unit: "mm";
  };
  conditions?: {
    processMethod?: string;
    materialFamily?: string;
    thicknessMm?: {
      min: number;
      minInclusive?: boolean; // default true
      max: number;
      maxInclusive?: boolean; // default true
    };
    toleranceGrade?: string;
    dimensionType?: "W" | "NW";
  };
  maximumRecommendedTotalBand: { value: number; unit: "mm" };
  fallbackPriority: number;
  fallbackEntryId?: string;
  capabilityTier: "T1" | "T2" | "T3";
  provenance: {
    classification: "internal";
    sourceFile: string;
    sourceFileHash: string;
    sourceVersion: string;
    sheetName: string;
    sourceRange: string;
    owner: string;
    confidence: number;
    effectiveVersion: "internal-v1";
    changeSummary: string;
  };
}
```

### 区间端点语义

`nominalRange` 与 `conditions.thicknessMm` 支持独立的 `minInclusive` 和
`maxInclusive`。未写入标志时端点默认包含，以保持既有闭区间规则兼容；只有显式
`false` 才表示开放端点。区间必须至少包含一个数值，因此零长度区间只有两个端点均包含
时才有效。

这使发布规则能够无损保留源表的数学语义，例如 `Over 6 to 30 mm` 发布为
`{ min: 6, minInclusive: false, max: 30, maxInclusive: true, unit: "mm" }`，即
$(6, 30]$。相邻规则只在一个至少被排除的公共端点相接时不重叠；两个规则都包含该端点
时仍属于同优先级歧义并被拒绝。禁止使用 epsilon 伪造边界。

候选审核报告中的 `not specified by source` 不能仅因端点模型已支持而发布；仍须由知识
库负责人批准 feature-only 匹配语义及冲突检查。通用表格导入器当前只产生默认闭区间，
开放端点规则只能经已审核的发布转换写入快照，直到导入协议另行扩展。

`maximumRecommendedTotalBand` 是设计指导阈值，不是最小可达制造公差。`capabilityTier`
只描述证据等级：`T1` 为受控实测/PPAP 证据，`T2` 为受控历史或供应商输入，`T3` 为
经审核工程估算。它不改变上述单向筛查语义。

## 查询契约与判定

F2 必须使用以下最小上下文调用 F0：

```ts
assessToleranceGuidance({
  processFamily: "cnc-machining",
  featureType: "hole-diameter",
  nominalValue: 12,
  nominalUnit: "mm",
  tolerance: { representation: "bilateral", value: 0.08, unit: "mm" },
  material: "aluminum",
});
```

F0 依序选择匹配规则：

```text
制程 + 特征 + 材料 + 尺寸区间
-> 制程 + 特征 + 尺寸区间
-> 制程 + 特征
-> 明确关联的制程通用 fallback
-> unknown / T0
```

仅当候选规则唯一且所有必填上下文被覆盖时才返回匹配。多个同优先级规则、未覆盖尺寸
或无明确 fallback 均为 `unknown`；不得选择“最接近”的规则。

```ts
type ToleranceGuidanceResult =
  | {
      status: "within-guidance";
      knowledgeBaseVersion: "internal-v1";
      matchedEntryId: string;
      assessedTotalBand: { value: number; unit: "mm" };
      maximumRecommendedTotalBand: { value: number; unit: "mm" };
      fallbackApplied: boolean;
      evidence: { sourceFile: string; sheetName: string; sourceRange: string; sourceFileHash: string };
    }
  | {
      status: "guidance-exceeded";
      knowledgeBaseVersion: "internal-v1";
      matchedEntryId: string;
      assessedTotalBand: { value: number; unit: "mm" };
      maximumRecommendedTotalBand: { value: number; unit: "mm" };
      fallbackApplied: boolean;
      evidence: { sourceFile: string; sheetName: string; sourceRange: string; sourceFileHash: string };
    }
  | {
      status: "unknown";
      knowledgeBaseVersion: "internal-v1";
      capabilityTier: "T0";
      message: "制程能力未知，请与供应商确认";
    };
```

当归一化后的 TA 总公差带大于 `maximumRecommendedTotalBand` 时，返回
`guidance-exceeded`；相等或更小时返回 `within-guidance`。两种已命中状态都是参考
指导结果，F2 必须显示为需要工程师复核的事实性比较，不得转述为设计批准或拒绝。

## 导入与发布流程

1. 对来源工作簿计算 SHA-256，并在 manifest 登记来源版本和分类。
2. 按已批准的表头映射读取工作表；保留源工作表、行列范围、合并单元格和单位信息。
3. 将每一行转换为候选规则，并对公差表示和单位进行显式归一化。
4. 拒绝缺少制程、特征、阈值、单位、来源范围或回退目标的候选规则。
5. 验证稳定 ID 唯一性、尺寸区间不倒置、阈值为正、回退目标存在且优先级无歧义。
6. 审核转换结果并生成不可变 `internal-v1` 快照、manifest 和库内容 hash。
7. 通过 Git/PR 发布仅允许提交的规则快照与不含原文的元数据；原始文件按上述治理
   前置条件处理。

任一来源 hash、规则 hash、manifest 条目数、版本或回退关系不一致时，加载器必须拒绝
整个内部快照，禁止以部分规则继续运行。

## 实现范围

- 扩展 `@ai-assist/contracts`，定义 `internal-v1` 的严格规则、manifest、请求和结果 schema。
- 在 `@ai-assist/knowledge-base` 增加内部快照校验、确定性匹配、总公差带归一化与只读 API。
- 提供维护期导入器，并为六个制程族提供经审核的规则数据。
- 在 F2 实现时，通过 F0 API 消费结果和证据 DTO，不解析源 Excel。
- 更新 Feature Register、数据分类治理与 README，明确内部数据的加载权限和 F2 可见证据范围。

## 非范围

- 公差过紧、最小可制造公差、供应商制造能力、成本、Cpk、PPAP 结论。
- 自动审批、自动回写 TA、替代工程师决策或自动选择未知上下文的近似规则。
- 运行时读取任意路径、URL、上传的 Excel，或在 F2 调用中动态导入规则。
- 在治理例外获批前将内部 `.xlsx/.xlsm` 原始文件提交到 Git。

## 验收标准

1. 六个制程族均至少有一条已审核规则，且 manifest 可追溯至来源 hash、工作表和范围。
2. 双边与单边公差的总带宽归一化结果正确，单位或表示不明确时返回 `unknown/T0`。
3. 公差大于已命中规则的最大推荐总带宽时返回 `guidance-exceeded`；相等或较小时返回
   `within-guidance`。
4. 精确匹配优先于 fallback；同优先级歧义、无覆盖尺寸或无回退目标均返回 `unknown/T0`。
5. 所有结果冻结且防御性复制；调用方修改结果不会影响后续查询。
6. `public/v1` 加载器不能加载内部快照，内部 API 也不能将结果标记为 `public`。
7. F2 可展示命中证据的文件名、工作表和范围，但不会暴露工作簿原文或未命中规则内容。
8. 根目录 `build`、`lint`、`test` 与 `check:repository` 通过；原始 Excel 的提交仅在治理
   例外获批并通过白名单校验后允许。