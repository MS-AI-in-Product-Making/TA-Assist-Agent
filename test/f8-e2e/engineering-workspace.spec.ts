import { createHash } from "node:crypto";

import { expect, test } from "./workbench-fixture.js";

const ADO_SELECTION_SESSION_ID = "50505050-5050-4505-8505-505050505050";
const ADO_CREATE_PREVIEW_SESSION_ID = "60606060-6060-4606-8606-606060606060";
const ADO_UPDATE_PREVIEW_SESSION_ID = "70707070-7070-4707-8707-707070707070";
const LONG_WORKBOOK_FILE_NAME = "anonymous-ta-workbook-very-long-governed-ui-filename-for-layout-overlap-validation-2026-09-01.xlsx";
const CANONICAL_FACTOR_HEADERS = [
  "Loop Label",
  "Factor Description",
  "Part Name",
  "Drawing Number",
  "DIM ID",
  "Part Category",
  "Design Nominal",
  "+ Tolerance",
  "- Tolerance",
  "Long Term/Safety Factor",
  "Sigma Level",
  "Distribution",
  "Mean",
  "Tolerance",
  "One Sigma",
  "% Contribution to Sigma",
  "Notes",
  "Capability Result",
  "Knowledge Recommendation",
];

test.describe.configure({ timeout: 90_000 });

function reviewArtifactId(kind, sessionId) {
  return `${kind}:${sessionId}`;
}

function markdownCells(line: string) {
  return line.slice(1, -1).split("|").map((cell) => cell.trim().replaceAll("\\|", "|"));
}

function parseRenderedAdoGroups(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const groups = [];
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index];
    const match = heading?.match(/^### Part \/ Subsystem: (.*) \((\d+) factors\)$/);
    if (match === null) continue;
    const summary = markdownCells(lines[index + 3] ?? "");
    const rows = [];
    for (let rowIndex = index + 7; rowIndex < lines.length; rowIndex += 1) {
      const line = lines[rowIndex] ?? "";
      if (line.length === 0 || line.startsWith("### ")) break;
      rows.push(markdownCells(line));
    }
    groups.push({
      partSubsystem: match[1],
      factorCount: Number(match[2]),
      missingDrawing: Number(summary[1]),
      missingDimId: Number(summary[2]),
      rows,
    });
  }
  return groups;
}

async function readCsrf(page, origin: string) {
  const response = await page.request.get(`${origin}/api/csrf`);
  if (!response.ok()) throw new Error(`csrf fetch failed (${response.status()})`);
  return (await response.json()).csrfToken;
}

async function waitForHydratedAdoWorkspace(page, sessionId) {
  await page.waitForURL((url) => url.searchParams.get("session") === sessionId && url.hash.length === 0);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator(".connection-indicator")).toHaveText("Connected");
  const adoSection = page.getByRole("region", { name: "ADO workspace" });
  await expect(adoSection).toBeVisible();
  return adoSection;
}

async function readPreviewDetails(section) {
  return section.locator(".ado-workspace__preview dl").evaluate((list) => Object.fromEntries(
    [...list.querySelectorAll("div")].map((entry) => [
      entry.querySelector("dt")?.textContent?.trim() ?? "",
      entry.querySelector("dd")?.textContent?.trim() ?? "",
    ]),
  ));
}

async function assertNoProgressOverlaps(page) {
  const overlaps = await page.locator(".analysis-progress").evaluate((root) => {
    const toRect = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    };
    const intersects = (a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }) => (
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    );
    const issues: string[] = [];
    const steps = [...root.querySelectorAll(".analysis-progress__step")];
    for (const [index, step] of steps.entries()) {
      const marker = step.querySelector(".analysis-progress__marker");
      const content = step.querySelector(".analysis-progress__content");
      if (marker !== null && content !== null && intersects(toRect(marker), toRect(content))) {
        issues.push(`marker-content-overlap:${index}`);
      }
    }
    for (let index = 0; index < steps.length - 1; index += 1) {
      const current = steps[index]?.querySelector(".analysis-progress__content");
      const next = steps[index + 1]?.querySelector(".analysis-progress__content");
      if (current !== null && next !== null && current !== undefined && next !== undefined && intersects(toRect(current), toRect(next))) {
        issues.push(`adjacent-content-overlap:${index}`);
      }
    }
    return issues;
  });
  expect(overlaps).toEqual([]);
}

test("shows the user engineering shell with the simplified progress track", async ({ page, workbench }) => {
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
  const snapshotResponse = await page.request.get(`${workbench.origin}/api/sessions/${encodeURIComponent(workbench.sessionId)}`);
  expect(snapshotResponse.status()).toBe(200);
  const snapshot = await snapshotResponse.json();
  expect(snapshot.initialScopeSelection?.provenance).toBe("user");
  expect(snapshot.downstreamScopeSelection?.provenance).toBe("user");

  await expect(page.getByText("TA Assist", { exact: true })).toBeVisible();
  await expect(page.getByText("Tolerance loop stack-up", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Worksheet" })).toBeVisible();
  await expect(page.getByRole("region", { name: "TA Assistant" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open TA Assistant" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Analysis progress" })).toBeVisible();
  const progressRegion = page.getByRole("region", { name: "Analysis progress" });
  await expect(progressRegion.locator(".analysis-progress__content strong")).toHaveText([
    "Prepare workbook",
    "Validate analysis inputs",
    "Review dimension traceability",
    "Calculate and interpret tolerance performance",
    "Evaluate improvement options and publish report",
  ]);
  await expect(page.getByText("Current worksheet", { exact: true })).toBeVisible();
  await expect(page.getByText(/f4_running|ado_action_pending|activeAttempt|review_required/)).toHaveCount(0);

  const normalUiText = await page.locator("main.engineering-shell").innerText();
  expect(normalUiText).not.toMatch(/\bF[1-7](?:\.[0-9]+)?\b/);

  const sectionOrder = await page.evaluate(() => {
    const overview = document.querySelector(".workbook-overview");
    const currentWorksheet = document.querySelector(".worksheet-heading");
    if (!(overview instanceof HTMLElement) || !(currentWorksheet instanceof HTMLElement)) {
      throw new Error("workspace sections are missing");
    }
    return {
      overviewTop: overview.getBoundingClientRect().top,
      worksheetTop: currentWorksheet.getBoundingClientRect().top,
      followsInDom: Boolean(overview.compareDocumentPosition(currentWorksheet) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  expect(sectionOrder.overviewTop).toBeLessThan(sectionOrder.worksheetTop);
  expect(sectionOrder.followsInDom).toBe(true);
});

test("creates a governed model HostAction prompt from the selected worksheet context", async ({ page, workbench }) => {
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
  await expect(page.getByRole("combobox", { name: "Worksheet" })).toHaveAttribute("placeholder", "AJ_GAP");
  await page.getByRole("button", { name: "AJ center to C-bucket", description: "中心间隙" }).click();
  const baselineSystemSpecification = await page.getByLabel("Analysis target details").innerText();
  await page.getByRole("button", { name: "Open TA Assistant" }).click();
  await expect(page.getByRole("button", { name: "Close TA Assistant" })).toBeVisible();
  await workbench.seedConversationTurn({ sessionId: workbench.sessionId, turnId: "external-model-context", sequence: 1 });

  const currentF6ReportArtifactId = reviewArtifactId("f6-report-e2e", workbench.sessionId);
  const projectionArtifactId = `engineering-summary-projection:1:${workbench.sessionId}`;
  const webReportResponse = await page.request.get(`${workbench.origin}/api/sessions/${encodeURIComponent(workbench.sessionId)}/artifacts/${encodeURIComponent(currentF6ReportArtifactId)}`);
  if (!webReportResponse.ok()) throw new Error(`f6 report fetch failed (${webReportResponse.status()})`);
  const webReportHash = createHash("sha256").update(await webReportResponse.body()).digest("hex");
  const projectionResponse = await page.request.get(`${workbench.origin}/api/sessions/${encodeURIComponent(workbench.sessionId)}/artifacts/${encodeURIComponent(projectionArtifactId)}`);
  if (!projectionResponse.ok()) throw new Error(`projection fetch failed (${projectionResponse.status()})`);
  const webProjection = JSON.parse((await projectionResponse.body()).toString("utf8"));
  expect(webProjection).toMatchObject({
    schemaVersion: "ta-engineering-report-projection-v1",
    worksheetDispositions: [{ worksheetName: "AJ_GAP", disposition: "FAIL" }],
    worksheets: [
      expect.objectContaining({
        worksheetName: "AJ_GAP",
        gatingEvidenceReferences: expect.arrayContaining(["F6:AJ_GAP:summary"]),
      }),
    ],
  });

  const postedSelectionPromise = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith(`/api/sessions/${encodeURIComponent(workbench.sessionId)}/conversation`));
  const postedResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith(`/api/sessions/${encodeURIComponent(workbench.sessionId)}/conversation`));
  await page.getByRole("textbox", { name: "Ask TA Assist from governed evidence" }).fill("Explain the current tolerance risk and identify missing evidence.");
  await page.getByRole("button", { name: "Send message" }).click();
  const postedJson = (await postedSelectionPromise).postDataJSON();
  expect(postedJson.selection).toEqual({
    worksheetName: "AJ_GAP",
    tableId: "table-a",
    sourceRow: 2,
    factorName: "中心间隙",
    calculationReference: "what-if:e2e-draft",
  });
  expect(postedJson.turn).toMatchObject({ sequence: 0, source: "web", role: "user" });
  const createResponse = await postedResponsePromise;
  expect({ status: createResponse.status(), body: await createResponse.text() }).toEqual(expect.objectContaining({ status: 201 }));

  const turnId = String(postedJson.turn.turnId);

  const actionId = `model:${turnId}`;
  const hostInstanceId = "playwright-model-host";
  const claimToken = await workbench.issueHostBearer({ sessionId: workbench.sessionId, scopes: ["host-actions:claim"], actionId, hostInstanceId });
  const claimResponse = await page.request.post(`${workbench.origin}/api/sessions/${encodeURIComponent(workbench.sessionId)}/host-actions/${encodeURIComponent(actionId)}/claim`, {
    headers: { authorization: `Bearer ${claimToken}` },
    data: { hostInstanceId },
  });
  expect(claimResponse.status()).toBe(200);
  const claim = await claimResponse.json();
  const prompt = claim.request.prompt;

  expect(claim.request.kind).toBe("vscode_model_request");
  expect(prompt).toContain("Governed evidence");
  expect(prompt).toContain("Open interpretation");
  expect(prompt).toContain("Missing evidence");
  expect(prompt).toContain("Suggested checks");
  expect(prompt).toContain(`Session: ${workbench.sessionId} (revision `);
  expect(prompt).toContain("inputRevision 1)");
  expect(prompt).toContain("Worksheet: AJ_GAP");
  expect(prompt).toContain("Selected factor identity: table-a / row 2 / 中心间隙");
  expect(prompt).toContain("Scenario identity: what-if:e2e-draft");
  expect(prompt).toContain(`Related artifact IDs: f2-report:1:f2-run-e2e-${workbench.sessionId}, f4-calculation:1:${workbench.sessionId}, f1-image:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`);
  expect(prompt).toContain('"capabilityStatus":"internal_within_guidance"');
  expect(prompt).toContain('"f0KnowledgeBaseVersion":"internal-v1"');
  expect(prompt).toContain("Data Parsing managed image reference");
  expect(prompt).toContain('"mediaType":"image/png"');
  expect(prompt).toContain("Data Cleaning factor table excerpts (1 of 1)");
  expect(prompt).toContain("TA Calculation baseline metrics");
  expect(prompt).toContain('"calculationReference":"run-1"');
  expect(prompt).toContain("Scenario metrics");
  expect(prompt).toContain('"calculationReference":"what-if:e2e-draft"');
  expect(prompt).toContain("- None identified in the current governed context.");
  expect(prompt).not.toContain("test/f8-e2e/generated");
  expect(prompt).not.toContain("C:\\");

  const modelPayload = {
    status: "completed" as const,
    outcome: {
      kind: "model_response" as const,
      turnId,
      responseText: [
        "Governed evidence: Knowledge Library, Data Parsing, Data Cleaning, TA Calculation, and saved Scenario identities were provided.",
        "Open interpretation: Risk appears driven by the selected factor and Scenario delta.",
        "Adjustment category: system_specification (model suggestion only).",
        "Suggested spec delta: LSL -0.15 mm -> -0.10 mm (requires requirement-owner authorization).",
        "Missing evidence: None identified in the current governed context.",
        "Suggested checks: Confirm the selected factor identity before action.",
      ].join("\n"),
    },
  };
  const resultToken = await workbench.issueHostBearer({ sessionId: workbench.sessionId, scopes: ["host-actions:result"], actionId, hostInstanceId });
  const resultResponse = await page.request.post(`${workbench.origin}/api/sessions/${encodeURIComponent(workbench.sessionId)}/host-actions/${encodeURIComponent(actionId)}/result`, {
    headers: { authorization: `Bearer ${resultToken}` },
    data: {
      contractVersion: "f8-host-action-result-v1",
      actionId,
      hostInstanceId,
      leaseId: claim.leaseId,
      status: "completed",
      resultHash: createHash("sha256").update(JSON.stringify(modelPayload)).digest("hex"),
      payload: modelPayload,
    },
  });
  expect(resultResponse.status()).toBe(204);

  const conversationResponse = await page.request.get(`${workbench.origin}/api/sessions/${encodeURIComponent(workbench.sessionId)}/conversation`);
  expect(conversationResponse.status()).toBe(200);
  const conversation = await conversationResponse.json();
  expect(conversation.turns.map((turn) => ({ turnId: turn.turnId, sequence: turn.sequence, source: turn.source }))).toEqual([
    { turnId: "external-model-context", sequence: 1, source: "vscode" },
    { turnId, sequence: 2, source: "web" },
    { turnId: `${turnId}:assistant`, sequence: 3, source: "system" },
    { turnId: `${turnId}:model`, sequence: 4, source: "vscode" },
  ]);
  expect(conversation.turns.at(-1)).toMatchObject({
    role: "assistant",
    content: [{ kind: "text", text: expect.stringContaining("Governed evidence: Knowledge Library, Data Parsing, Data Cleaning, TA Calculation, and saved Scenario identities were provided.") }],
  });
  const modelTurn = conversation.turns.find((entry) => entry.turnId === `${turnId}:model`);
  expect(modelTurn).toBeDefined();
  expect(modelTurn.relatedArtifactIds).toEqual([currentF6ReportArtifactId]);
  expect(modelTurn.content).toEqual(expect.arrayContaining([
    { kind: "artifact_reference", artifactId: currentF6ReportArtifactId, label: "Feature6-Report.md" },
    { kind: "tool_result", actions: [{ type: "open_report", target: "/report/current", label: "打开当前报告" }], commands: [] },
  ]));

  const vscodeReportResponse = await page.request.get(`${workbench.origin}/api/sessions/${encodeURIComponent(workbench.sessionId)}/artifacts/${encodeURIComponent(modelTurn.relatedArtifactIds[0])}`);
  if (!vscodeReportResponse.ok()) throw new Error(`vscode report fetch failed (${vscodeReportResponse.status()})`);
  const vscodeReportHash = createHash("sha256").update(await vscodeReportResponse.body()).digest("hex");
  expect(vscodeReportHash).toBe(webReportHash);

  await expect(page.getByLabel("Analysis target details")).toHaveText(baselineSystemSpecification);
});

test("keeps conversation closed by default and toggles drawer without reserving layout width", async ({ page, workbench }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
  const open = page.getByRole("button", { name: "Open TA Assistant" });
  await expect(open).toBeVisible();
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Close TA Assistant" })).toHaveCount(0);

  const widthClosed = await page.locator(".engineering-layout__workbench").evaluate((element) => element.getBoundingClientRect().width);
  await open.click();
  await expect(open).toHaveAttribute("aria-expanded", "true");
  const close = page.getByRole("button", { name: "Close TA Assistant" });
  await expect(close).toBeVisible();
  const widthOpen = await page.locator(".engineering-layout__workbench").evaluate((element) => element.getBoundingClientRect().width);
  await close.click();
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(close).toHaveCount(0);
  const widthClosedAgain = await page.locator(".engineering-layout__workbench").evaluate((element) => element.getBoundingClientRect().width);

  expect(Math.abs(widthOpen - widthClosed)).toBeLessThanOrEqual(2);
  expect(Math.abs(widthClosedAgain - widthClosed)).toBeLessThanOrEqual(2);
});

test("keeps visible engineering UI in English while preserving source tooltips", async ({ page, workbench }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);

  await expect(page.getByRole("button", { name: "AJ center to C-bucket", description: "中心间隙" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bracket reinforcement subassembly", description: "支架加强组件" })).toBeVisible();

  const scan = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (parent === null) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script, style, [aria-hidden='true'], .sr-only, .visually-hidden") !== null) return NodeFilter.FILTER_REJECT;
        const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
        return text.length === 0 ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    const visibleParts: string[] = [];
    while (walker.nextNode()) visibleParts.push(walker.currentNode.textContent?.replace(/\s+/g, " ").trim() ?? "");

    const sourceNodes = [...document.querySelectorAll(".source-text [title]")].map((element) => {
      const html = element as HTMLElement;
      const describedBy = html.getAttribute("aria-describedby");
      const describedText = describedBy === null ? undefined : document.getElementById(describedBy)?.textContent?.trim();
      return {
        text: html.textContent?.replace(/\s+/g, " ").trim() ?? "",
        title: html.getAttribute("title") ?? "",
        describedText: describedText ?? "",
      };
    });

    return {
      visibleText: visibleParts.join(" "),
      titleMatches: sourceNodes.filter((node) => /[\u4e00-\u9fff]/.test(node.title)),
      describedMatches: sourceNodes.filter((node) => /[\u4e00-\u9fff]/.test(node.describedText)),
    };
  });

  expect(scan.visibleText).not.toMatch(/[\u4e00-\u9fff]/);
  expect(scan.titleMatches).toEqual(expect.arrayContaining([
    expect.objectContaining({ text: "AJ center to C-bucket", title: "中心间隙" }),
    expect.objectContaining({ text: "Bracket reinforcement subassembly", title: "支架加强组件" }),
  ]));
  expect(scan.describedMatches).toEqual(expect.arrayContaining([
    expect.objectContaining({ text: "AJ center to C-bucket", describedText: "中心间隙" }),
    expect.objectContaining({ text: "Bracket reinforcement subassembly", describedText: "支架加强组件" }),
  ]));
});

test("matches the current F3 grouped rows and previews create or update targets without exposing duplicate ADO controls", async ({ browser, workbench }) => {
  const selectionContext = await browser.newContext();
  const createContext = await browser.newContext();
  const updateContext = await browser.newContext();
  try {
    const selectionBootstrap = await workbench.issueBootstrap(ADO_SELECTION_SESSION_ID);
    const createBootstrap = await workbench.issueBootstrap(ADO_CREATE_PREVIEW_SESSION_ID);
    const updateBootstrap = await workbench.issueBootstrap(ADO_UPDATE_PREVIEW_SESSION_ID);

    const selectionPage = await selectionContext.newPage();
    await selectionPage.goto(`${workbench.origin}/?session=${ADO_SELECTION_SESSION_ID}#bootstrap=${selectionBootstrap}`);
    const adoSection = await waitForHydratedAdoWorkspace(selectionPage, ADO_SELECTION_SESSION_ID);

    const f3Response = await selectionPage.request.get(`${workbench.origin}/api/sessions/${encodeURIComponent(ADO_SELECTION_SESSION_ID)}/artifacts/${encodeURIComponent(reviewArtifactId("f3-e2e", ADO_SELECTION_SESSION_ID))}`);
    if (!f3Response.ok()) throw new Error(`f3 fetch failed (${f3Response.status()})`);
    const f3Report = await f3Response.json();

    const reminderResponse = await selectionPage.request.get(`${workbench.origin}/api/sessions/${encodeURIComponent(ADO_SELECTION_SESSION_ID)}/artifacts/${encodeURIComponent(reviewArtifactId("f3-ado-reminder-e2e", ADO_SELECTION_SESSION_ID))}`);
    if (!reminderResponse.ok()) throw new Error(`f3 reminder fetch failed (${reminderResponse.status()})`);
    const canonicalReminder = await reminderResponse.json();
    const canonicalReminderMarkdown = canonicalReminder.markdown;
    const expectedGroups = parseRenderedAdoGroups(canonicalReminderMarkdown);

    expect(f3Report.summary.factorCount).toBe(3);
    expect(f3Report.worksheets).toHaveLength(2);
    expect(canonicalReminderMarkdown).toContain("## F3 DIM ID / Drawing Governance Reminder");
    expect(canonicalReminderMarkdown).toContain("| Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Governance issue |");
    expect(expectedGroups.map((group) => ({ partSubsystem: group.partSubsystem, factorCount: group.factorCount, missingDrawing: group.missingDrawing, missingDimId: group.missingDimId }))).toEqual(canonicalReminder.groups.map((group) => ({
      partSubsystem: group.partSubsystem,
      factorCount: group.factorCount,
      missingDrawing: group.missingDrawingNumberCount,
      missingDimId: group.missingDimIdCount,
    })));

    await expect(adoSection).toBeVisible();
    await expect(adoSection.getByText("3 Factors", { exact: true })).toBeVisible();
    await expect(adoSection.getByText("2 Groups", { exact: true })).toBeVisible();

    const buttonCounts = await Promise.all([
      selectionPage.getByRole("button", { name: "Local analysis only" }).count(),
      selectionPage.getByRole("button", { name: "Create work item" }).count(),
      selectionPage.getByRole("button", { name: "Validate existing work item" }).count(),
      selectionPage.getByRole("button", { name: "Confirm ADO write" }).count(),
    ]);
    expect(buttonCounts).toEqual([1, 1, 1, 0]);

    const visibleText = await adoSection.evaluate((element) => element.innerText.replace(/\s+/g, " "));
    expect(visibleText).toContain("ADO workspace");
    expect(visibleText).toContain("Governance write decision");
    expect(visibleText).not.toMatch(/[\u4e00-\u9fff]/);
    expect(visibleText).not.toMatch(/\bF[1-7](?:\.[0-9]+)?\b/);

    for (const group of expectedGroups) {
      const details = adoSection.locator("details").filter({ has: selectionPage.locator("summary strong", { hasText: group.partSubsystem }) }).first();
      await expect(details).toBeVisible();
      await details.locator("summary").click();
      await expect(details.getByText(`${group.factorCount} Factors`, { exact: true })).toBeVisible();
      await expect(details.getByText(`Drawing missing ${group.missingDrawing}`, { exact: true })).toBeVisible();
      await expect(details.getByText(`DIM ID missing ${group.missingDimId}`, { exact: true })).toBeVisible();
      const rows = await details.locator("tbody tr").evaluateAll((tableRows) => tableRows.map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim() ?? "")));
      expect(rows).toEqual(group.rows);
    }

    await selectionPage.getByRole("button", { name: "Local analysis only" }).click();
    await expect(selectionPage.getByRole("button", { name: "Local analysis only" })).toHaveCount(0);
    await expect(selectionPage.getByRole("button", { name: "Create work item" })).toHaveCount(0);
    await expect(selectionPage.getByRole("button", { name: "Validate existing work item" })).toHaveCount(0);

    const createPage = await createContext.newPage();
    await createPage.goto(`${workbench.origin}/?session=${ADO_CREATE_PREVIEW_SESSION_ID}#bootstrap=${createBootstrap}`);
    const createSection = await waitForHydratedAdoWorkspace(createPage, ADO_CREATE_PREVIEW_SESSION_ID);
    await expect.poll(async () => {
      const response = await createPage.request.get(`${workbench.origin}/api/sessions/${encodeURIComponent(ADO_CREATE_PREVIEW_SESSION_ID)}/ado`);
      if (!response.ok()) throw new Error(`ado fetch failed (${response.status()})`);
      return response.json();
    }).toMatchObject({
      state: "preview_ready",
      target: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx" },
      confirmation: { factorCount: 3 },
    });
    const createProjectionResponse = await createPage.request.get(`${workbench.origin}/api/sessions/${encodeURIComponent(ADO_CREATE_PREVIEW_SESSION_ID)}/ado`);
    if (!createProjectionResponse.ok()) throw new Error(`ado fetch failed (${createProjectionResponse.status()})`);
    const createProjection = await createProjectionResponse.json();
    await expect(createSection.getByRole("heading", { name: "Full governance preview" })).toBeVisible();
    await expect(createSection.getByText("WI-900", { exact: true })).toBeVisible();
    await expect(readPreviewDetails(createSection)).resolves.toMatchObject({ "Work Item": "WI-900", Factors: "3" });
    await expect(createSection.getByRole("button", { name: "Confirm ADO write" })).toBeVisible();
    await expect(createSection.locator("pre")).toContainText("## F3 DIM ID / Drawing Governance Reminder");

    await expect(createSection.getByRole("button", { name: "Create work item" })).toHaveCount(0);
    await expect(createSection.getByRole("button", { name: "Validate existing work item" })).toHaveCount(0);

    const updatePage = await updateContext.newPage();
    await updatePage.goto(`${workbench.origin}/?session=${ADO_UPDATE_PREVIEW_SESSION_ID}#bootstrap=${updateBootstrap}`);
    const updateSection = await waitForHydratedAdoWorkspace(updatePage, ADO_UPDATE_PREVIEW_SESSION_ID);
    await expect.poll(async () => {
      const response = await updatePage.request.get(`${workbench.origin}/api/sessions/${encodeURIComponent(ADO_UPDATE_PREVIEW_SESSION_ID)}/ado`);
      if (!response.ok()) throw new Error(`ado fetch failed (${response.status()})`);
      return response.json();
    }).toMatchObject({
      state: "preview_ready",
      target: { mode: "existing", workItemReference: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/42" },
    });
    const updateProjectionResponse = await updatePage.request.get(`${workbench.origin}/api/sessions/${encodeURIComponent(ADO_UPDATE_PREVIEW_SESSION_ID)}/ado`);
    if (!updateProjectionResponse.ok()) throw new Error(`ado fetch failed (${updateProjectionResponse.status()})`);
    const updateProjection = await updateProjectionResponse.json();
    await expect(updateSection.getByRole("heading", { name: "Full governance preview" })).toBeVisible();
    await expect(updateSection.getByText("WI-42", { exact: true })).toBeVisible();
    await expect(readPreviewDetails(updateSection)).resolves.toMatchObject({ "Work Item": "WI-42", Version: "7", Factors: "3" });

    expect(updateProjection.contentHash).toBe(createProjection.contentHash);
    expect(updateProjection.markdown).toBe(createProjection.markdown);
    await expect(updateSection.getByRole("button", { name: "Confirm ADO write" })).toBeVisible();
  } finally {
    await selectionContext.close();
    await createContext.close();
    await updateContext.close();
  }
});

test("keeps canonical factor table and governed cockpit layout across desktop viewports", async ({ page, workbench }, testInfo) => {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);

    const visibleText = await page.locator("body").innerText();
    for (const stale of ["Original text", "Mean Offset", "Target nominal", "Upper tolerance", "Lower tolerance"]) {
      expect(visibleText).not.toContain(stale);
    }

    await expect(page.getByLabel("Analysis target details").getByText("Design Nominal", { exact: true })).toBeVisible();
    await expect(page.getByText("-0.05 mm", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Analysis target details").getByText("Lower Spec Limit", { exact: true })).toBeVisible();
    await expect(page.getByText("-0.15 mm", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Analysis target details").getByText("Upper Spec Limit", { exact: true })).toBeVisible();
    await expect(page.getByText("0.05 mm", { exact: true })).toBeVisible();

    const section = page.locator(".factor-table-section");
    await expect(section).toBeVisible();
    const headerTexts = await section.locator("thead th").evaluateAll((cells) => cells.map((cell) => cell.textContent?.trim() ?? ""));
    expect(headerTexts).toEqual(CANONICAL_FACTOR_HEADERS);

    const toolbar = await page.locator(".workspace-toolbar").evaluate((element) => {
      const workbookName = element.querySelector(".workspace-toolbar__workbook-name");
      const picker = element.querySelector(".worksheet-picker");
      const actions = element.querySelector(".workspace-toolbar__actions");
      if (!(workbookName instanceof HTMLElement) || !(picker instanceof HTMLElement) || !(actions instanceof HTMLElement)) {
        throw new Error("workspace toolbar layout elements are missing");
      }
      const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const nameRect = workbookName.getBoundingClientRect();
      const pickerRect = picker.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      return {
        title: workbookName.title,
        overlapsPicker: overlaps(nameRect, pickerRect),
        overlapsActions: overlaps(nameRect, actionsRect),
      };
    });
    expect(toolbar.title).toBe(LONG_WORKBOOK_FILE_NAME);
    expect(toolbar.overlapsPicker).toBe(false);
    expect(toolbar.overlapsActions).toBe(false);

    await page.locator(".analysis-cockpit").scrollIntoViewIfNeeded();
    const viewportState = await page.evaluate(() => {
      const cockpit = document.querySelector(".analysis-cockpit");
      const tableSection = cockpit?.querySelector(".factor-table-section");
      const tableBody = tableSection?.querySelector(".factor-table-section__body");
      const livePanel = cockpit?.querySelector(".analysis-cockpit__live");
      const evidenceStage = document.querySelector(".evidence-pane__stage");
      const image = evidenceStage?.querySelector("img");
      if (!(cockpit instanceof HTMLElement) || !(tableSection instanceof HTMLElement) || !(tableBody instanceof HTMLElement) || !(livePanel instanceof HTMLElement) || !(evidenceStage instanceof HTMLElement) || !(image instanceof HTMLImageElement)) {
        throw new Error("task 5 cockpit elements are missing");
      }
      const withinViewport = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
      };
      return {
        tableVisible: withinViewport(tableSection),
        liveVisible: withinViewport(livePanel),
        evidenceHeight: evidenceStage.getBoundingClientRect().height,
        imageNaturalWidth: image.naturalWidth,
        imageNaturalHeight: image.naturalHeight,
        bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        tableOverflowX: getComputedStyle(tableBody).overflowX,
        tableScrollWidth: tableBody.scrollWidth,
        tableClientWidth: tableBody.clientWidth,
      };
    });

    expect(viewportState.tableVisible).toBe(true);
    expect(viewportState.liveVisible).toBe(true);
    expect(viewportState.evidenceHeight).toBeLessThanOrEqual(180);
    expect(viewportState.imageNaturalWidth).toBeGreaterThan(0);
    expect(viewportState.imageNaturalHeight).toBeGreaterThan(0);
    expect(viewportState.bodyOverflow).toBeLessThanOrEqual(1);
    expect(viewportState.documentOverflow).toBeLessThanOrEqual(1);
    expect(viewportState.tableOverflowX).toBe("auto");
    expect(viewportState.tableScrollWidth).toBeGreaterThanOrEqual(viewportState.tableClientWidth);

    await expect(page.getByLabel("Metric strip")).toBeVisible();
    await expect(page.getByText("Factor contribution", { exact: true })).toBeVisible();
    await expect(page.getByText("Specification range and predicted distribution", { exact: true })).toBeVisible();
    await assertNoProgressOverlaps(page);
    await page.screenshot({ path: testInfo.outputPath(`task-5-workspace-${viewport.width}x${viewport.height}.png`), fullPage: true });
  }
});

test("keeps mobile and tablet views overflow-safe with usable local drawer and table scrolling", async ({ page, workbench }, testInfo) => {
  for (const viewport of [{ width: 900, height: 1200 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
    await expect(page.locator(".factor-table-section")).toBeVisible();
    await expect(page.locator(".factor-table-section__body")).toBeVisible();

    const layout = await page.evaluate(() => {
      const tableBody = document.querySelector(".factor-table-section__body");
      if (!(tableBody instanceof HTMLElement)) throw new Error("factor table body is missing");
      return {
        bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        tableOverflowX: getComputedStyle(tableBody).overflowX,
        tableScrollWidth: tableBody.scrollWidth,
        tableClientWidth: tableBody.clientWidth,
      };
    });

    expect(layout.bodyOverflow).toBeLessThanOrEqual(1);
    expect(layout.tableOverflowX).toBe("auto");
    expect(layout.tableScrollWidth).toBeGreaterThan(layout.tableClientWidth);

    const open = page.getByRole("button", { name: "Open TA Assistant" });
    await expect(open).toBeVisible();
    await open.click();
    const close = page.getByRole("button", { name: "Close TA Assistant" });
    await expect(close).toBeVisible();
    await close.focus();
    await expect(close).toBeFocused();
    await close.click();
    await expect(close).toHaveCount(0);

    await assertNoProgressOverlaps(page);
    await page.screenshot({ path: testInfo.outputPath(`task-5-workspace-${viewport.width}x${viewport.height}.png`), fullPage: true });
  }
});

test("supports specification plot drag, keyboard, numeric commit paths, and keeps the layout stable", async ({ page, workbench }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);

  await page.getByRole("button", { name: "AJ center to C-bucket", description: "中心间隙" }).click();

  const plot = page.getByTestId("specification-plot");
  const lslInput = page.getByRole("spinbutton", { name: "Lower Spec Limit" });
  const uslInput = page.getByRole("spinbutton", { name: "Upper Spec Limit" });
  const lslSlider = page.getByRole("slider", { name: "Lower Spec Limit line" });
  const uslSlider = page.getByRole("slider", { name: "Upper Spec Limit line" });

  await expect(plot).toBeVisible();
  await expect(page.getByText("Baseline mean 0.000 · statistical range -0.050 to 0.050", { exact: true })).toBeVisible();

  await lslInput.fill("-0.120");
  await lslInput.blur();
  await expect(lslInput).toHaveValue("-0.12");

  await uslInput.fill("-0.120");
  await uslInput.press("Enter");
  await expect(page.getByText("USL must stay above LSL.", { exact: true })).toBeVisible();
  await expect(uslInput).toHaveValue("-0.119");

  await uslSlider.focus();
  await uslSlider.press("ArrowRight");
  await uslSlider.press("Enter");
  await expect(uslInput).toHaveValue("-0.118");

  await expect(lslSlider).toBeVisible();
  await expect(uslSlider).toBeVisible();

  const layout = await page.locator(".chart-grid").evaluate((element) => {
    const figure = element.querySelectorAll("figure")[1];
    const stage = figure?.querySelector(".spec-plot__stage");
    const svg = figure?.querySelector("svg");
    const legend = figure?.querySelector(".spec-plot__legend");
    const summary = figure?.querySelector(".spec-plot__summary");
    const labels = [...(svg?.querySelectorAll(".spec-limit-label") ?? [])].map((node) => {
      const text = node.textContent?.trim() ?? "";
      const y = Number(node.getAttribute("y") ?? "0");
      const anchor = node.getAttribute("text-anchor") ?? "";
      return { text, y, anchor };
    });
    if (!(figure instanceof HTMLElement) || !(stage instanceof HTMLElement) || !(svg instanceof SVGSVGElement) || !(legend instanceof HTMLElement) || !(summary instanceof HTMLElement)) {
      throw new Error("spec plot layout elements missing");
    }
    const figureRect = figure.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const legendRect = legend.getBoundingClientRect();
    const summaryRect = summary.getBoundingClientRect();
    return {
      figureScrollWidth: figure.scrollWidth,
      figureClientWidth: figure.clientWidth,
      stageRight: stageRect.right,
      svgRight: svgRect.right,
      legendBottom: legendRect.bottom,
      summaryBottom: summaryRect.bottom,
      figureBottom: figureRect.bottom,
      labels,
    };
  });

  expect(layout.figureScrollWidth).toBeLessThanOrEqual(layout.figureClientWidth + 32);
  expect(layout.svgRight).toBeLessThanOrEqual(layout.stageRight + 1);
  expect(layout.summaryBottom).toBeLessThan(layout.figureBottom + 1);
  expect(layout.legendBottom).toBeLessThan(layout.figureBottom + 1);
  expect(layout.labels).toEqual(expect.arrayContaining([
    expect.objectContaining({ text: expect.stringMatching(/^LSL /) }),
    expect.objectContaining({ text: expect.stringMatching(/^USL /) }),
  ]));

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await page.locator(".chart-grid").evaluate((element) => {
    const body = document.body;
    const specFigure = element.querySelectorAll("figure")[1];
    if (!(specFigure instanceof HTMLElement)) throw new Error("spec figure missing");
    return {
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      figureScrollWidth: specFigure.scrollWidth,
      figureClientWidth: specFigure.clientWidth,
    };
  });

  expect(mobileLayout.bodyScrollWidth).toBeLessThanOrEqual(mobileLayout.bodyClientWidth);
  expect(mobileLayout.figureScrollWidth).toBeLessThanOrEqual(mobileLayout.figureClientWidth + 1);
  await page.screenshot({ path: testInfo.outputPath("task-4-specification-plot.png"), fullPage: true });
});
