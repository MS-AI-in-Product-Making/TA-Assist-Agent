import { createHash } from "node:crypto";

import { expect, test } from "./workbench-fixture.js";

const ADO_SELECTION_SESSION_ID = "50505050-5050-4505-8505-505050505050";
const ADO_CREATE_PREVIEW_SESSION_ID = "60606060-6060-4606-8606-606060606060";
const ADO_UPDATE_PREVIEW_SESSION_ID = "70707070-7070-4707-8707-707070707070";

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

test("shows the user engineering shell with the simplified progress track", async ({ page, workbench }) => {
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
  await expect(page.getByText("TA Assist", { exact: true })).toBeVisible();
  await expect(page.getByText("Tolerance loop stack-up", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Worksheet" })).toBeVisible();
  await expect(page.getByRole("region", { name: "TA Assistant" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Analysis progress" })).toBeVisible();
  await expect(page.getByText("Current worksheet", { exact: true })).toBeVisible();
  await expect(page.getByText(/f4_running|ado_action_pending|activeAttempt|review_required/)).toHaveCount(0);
});

test("creates a governed model HostAction prompt from the selected worksheet context", async ({ page, workbench }) => {
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
  await expect(page.getByRole("combobox", { name: "Worksheet" })).toHaveAttribute("placeholder", "AJ_GAP");
  await page.getByRole("button", { name: "AJ center to C-bucket", description: "中心间隙" }).click();
  await workbench.seedConversationTurn({ sessionId: workbench.sessionId, turnId: "external-model-context", sequence: 1 });

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
  expect(prompt).toContain(`Session: ${workbench.sessionId} (revision 1, inputRevision 1)`);
  expect(prompt).toContain("Worksheet: AJ_GAP");
  expect(prompt).toContain("Selected factor identity: table-a / row 2 / 中心间隙");
  expect(prompt).toContain("Scenario identity: what-if:e2e-draft");
  expect(prompt).toContain(`Related artifact IDs: f2-e2e:${workbench.sessionId}, f4-e2e:${workbench.sessionId}, f1-image:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`);
  expect(prompt).toContain('"capabilityStatus":"internal_within_guidance"');
  expect(prompt).toContain('"f0KnowledgeBaseVersion":"internal-v1"');
  expect(prompt).toContain("F1 managed image reference");
  expect(prompt).toContain('"mediaType":"image/png"');
  expect(prompt).toContain("F2 factor table excerpts (1 of 1)");
  expect(prompt).toContain("F4 baseline metrics");
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
        "Governed evidence: F0, F1, F2, F4, and saved Scenario identities were provided.",
        "Open interpretation: Risk appears driven by the selected factor and Scenario delta.",
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
    content: [{ kind: "text", text: expect.stringContaining("Governed evidence: F0, F1, F2, F4, and saved Scenario identities were provided.") }],
  });
});

test("keeps the mobile assistant off-canvas until requested", async ({ page, workbench }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
  const open = page.getByRole("button", { name: "Open TA Assistant" });
  await expect(open).toBeVisible();
  await open.click();
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Close TA Assistant" })).toBeVisible();
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

    const sourceNodes = [...document.querySelectorAll(".source-text > span[title]")].map((element) => {
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

test("shows the compact factor table without desktop horizontal scrolling", async ({ page, workbench }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);

  const section = page.locator(".factor-table-section");
  await expect(section).toBeVisible();
  await expect(section.getByText("1 Factors", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /show notes for aj center to c-bucket/i })).toBeVisible();
  const headerTexts = await section.locator("thead th").evaluateAll((cells) => cells.map((cell) => cell.textContent?.trim() ?? ""));

  expect(headerTexts).toEqual([
    "Row",
    "Factor & Process",
    "Part & IDs",
    "Nominal",
    "+Tol",
    "-Tol",
    "Results",
    "Contribution",
    "Status",
  ]);

  const dimensions = await section.evaluate((element) => {
    const table = element.querySelector(".factor-table");
    if (!(table instanceof HTMLElement)) throw new Error("factor table not found");
    const tableRect = table.getBoundingClientRect();
    const sectionRect = element.getBoundingClientRect();
    return {
      overflowX: getComputedStyle(element).overflowX,
      tableScrollWidth: table.scrollWidth,
      tableClientWidth: table.clientWidth,
      sectionClientWidth: element.clientWidth,
      tableRight: tableRect.right,
      sectionRight: sectionRect.right,
    };
  });

  expect(dimensions.overflowX).not.toBe("hidden");
  expect(dimensions.tableScrollWidth).toBeLessThanOrEqual(dimensions.sectionClientWidth);
  expect(dimensions.tableClientWidth).toBeLessThanOrEqual(dimensions.sectionClientWidth);
  expect(dimensions.tableRight).toBeLessThanOrEqual(dimensions.sectionRight);
});

test("renders the full-width evidence above the readable factor table", async ({ page, workbench }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);

  const evidencePane = page.locator(".evidence-pane");
  const factorTableSection = page.locator(".factor-table-section");

  await expect(evidencePane).toBeVisible();
  await expect(page.getByText("Tolerance loop description", { exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic gap", { exact: true })).toBeVisible();
  await expect(page.getByText("Target nominal", { exact: true })).toBeVisible();
  await expect(page.getByText("-0.050 mm", { exact: true })).toBeVisible();
  await expect(page.getByText("Upper tolerance", { exact: true })).toBeVisible();
  await expect(page.getByText("0.100 mm", { exact: true })).toBeVisible();
  await expect(page.getByText("Lower tolerance", { exact: true })).toBeVisible();
  await expect(page.getByText("-0.100 mm", { exact: true })).toBeVisible();

  const layout = await page.locator(".factor-evidence-layout").evaluate((element) => {
    const evidence = element.querySelector(".evidence-pane");
    const table = element.querySelector(".factor-table-section");
    const image = element.querySelector(".evidence-pane__stage img");
    if (!(evidence instanceof HTMLElement) || !(table instanceof HTMLElement) || !(image instanceof HTMLElement)) {
      throw new Error("task 4 layout elements not found");
    }
    const evidenceRect = evidence.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const parentRect = element.getBoundingClientRect();
    return {
      evidenceBottom: evidenceRect.bottom,
      tableTop: tableRect.top,
      evidenceLeft: evidenceRect.left,
      tableLeft: tableRect.left,
      evidenceWidth: evidenceRect.width,
      tableWidth: tableRect.width,
      parentWidth: parentRect.width,
      imageObjectFit: getComputedStyle(image).objectFit,
      imageRight: image.getBoundingClientRect().right,
      stageRight: (image.closest('.evidence-pane__stage') as HTMLElement).getBoundingClientRect().right,
    };
  });

  expect(layout.tableTop).toBeGreaterThan(layout.evidenceBottom);
  expect(Math.abs(layout.evidenceLeft - layout.tableLeft)).toBeLessThanOrEqual(2);
  expect(layout.imageObjectFit).toBe("contain");
  expect(layout.imageRight).toBeLessThanOrEqual(layout.stageRight + 1);
  expect(layout.evidenceWidth / layout.parentWidth).toBeGreaterThan(0.98);
  expect(layout.tableWidth / layout.parentWidth).toBeGreaterThan(0.98);

  const editWidths = await factorTableSection.locator('input[type="number"]').evaluateAll((inputs) => inputs.map((input) => input.getBoundingClientRect().width));
  expect(editWidths.every((width) => width >= 64)).toBe(true);

  const tableScroll = await factorTableSection.evaluate((element) => {
    const body = element.querySelector(".factor-table-section__body");
    if (!(body instanceof HTMLElement)) throw new Error("factor table body not found");
    return {
      overflowX: getComputedStyle(body).overflowX,
      scrollWidth: body.scrollWidth,
      clientWidth: body.clientWidth,
    };
  });

  expect(tableScroll.overflowX).not.toBe("hidden");
  expect(tableScroll.scrollWidth).toBeLessThanOrEqual(tableScroll.clientWidth);

  await page.screenshot({ path: testInfo.outputPath("task-4-desktop-evidence-layout.png"), fullPage: true });
});

test("stacks evidence above the factor table on mobile without page overflow", async ({ page, workbench }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
  await expect(page.locator(".factor-evidence-layout")).toBeVisible();
  await expect(page.locator(".factor-table-section__body")).toBeVisible();

  const positions = await page.evaluate(() => {
    const element = document.querySelector(".factor-evidence-layout");
    const evidence = element?.querySelector(".evidence-pane");
    const table = element?.querySelector(".factor-table-section");
    const tableBody = element?.querySelector(".factor-table-section__body");
    if (!(element instanceof HTMLElement) || !(evidence instanceof HTMLElement) || !(table instanceof HTMLElement) || !(tableBody instanceof HTMLElement)) {
      throw new Error("task 4 mobile layout elements not found");
    }
    const evidenceRect = evidence.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    return {
      evidenceTop: evidenceRect.top,
      tableTop: tableRect.top,
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      localOverflowX: getComputedStyle(tableBody).overflowX,
      tableScrollWidth: tableBody.scrollWidth,
      tableClientWidth: tableBody.clientWidth,
    };
  });

  expect(positions.evidenceTop).toBeLessThan(positions.tableTop);
  expect(positions.bodyScrollWidth).toBeLessThanOrEqual(positions.bodyClientWidth);
  expect(positions.localOverflowX).toBe("auto");
  expect(positions.tableScrollWidth).toBeGreaterThan(positions.tableClientWidth);
  await page.screenshot({ path: testInfo.outputPath("task-4-mobile-evidence-layout.png"), fullPage: true });
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
  await expect(page.getByRole("alert")).toHaveText("USL must stay above LSL.");
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

  expect(layout.figureScrollWidth).toBeLessThanOrEqual(layout.figureClientWidth + 1);
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
