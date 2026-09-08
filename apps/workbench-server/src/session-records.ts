import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { F8SessionSnapshot } from "@ai-assist/workbench";
import type { ConversationTurn } from "@ai-assist/conversation";

export async function writeSessionRecord(rootDir: string, snapshot: F8SessionSnapshot, conversation: readonly ConversationTurn[] = []): Promise<void> {
  const directory = join(rootDir, "runtime", "workbench", "session-records", snapshot.sessionId);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    atomic(join(directory, "Session-Snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`),
    atomic(join(directory, "Artifact-Manifest.json"), `${JSON.stringify({ sessionId: snapshot.sessionId, inputRevision: snapshot.inputRevision, artifacts: snapshot.artifactRefs ?? [], runs: snapshot.priorRunReferences }, null, 2)}\n`),
    atomic(join(directory, "Session-Summary.md"), summary(snapshot)),
    atomic(join(directory, "Conversation.md"), conversationMarkdown(conversation)),
  ]);
}

function summary(snapshot: F8SessionSnapshot): string {
  const lines = ["# TA Assist Agent Session Record", "", `- Session: \`${snapshot.sessionId}\``, `- Input revision: ${snapshot.inputRevision}`, `- State: \`${snapshot.state}\``, "", "## Artifacts", "", "| Kind | Artifact ID | Revision | Validated |", "| --- | --- | ---: | --- |", ...(snapshot.artifactRefs ?? []).map((artifact) => `| ${artifact.kind} | \`${artifact.artifactId}\` | ${artifact.revision} | ${artifact.validated} |`), "", "## Worksheet Scope", "", ...(snapshot.downstreamScopeSelection?.selectedWorksheetNames ?? snapshot.initialScopeSelection?.selectedWorksheetNames ?? []).map((name) => `- ${name}`), ""];
  return `${lines.join("\n")}\n`;
}
function conversationMarkdown(turns: readonly ConversationTurn[]): string { return `${["# TA Assist Agent Conversation", "", ...turns.flatMap((turn) => [`## ${turn.role} · ${turn.createdAt}`, "", ...turn.content.flatMap((part) => part.kind === "text" ? [part.text, ""] : []), ""])].join("\n")}\n`; }
async function atomic(path: string, content: string) { const temp = `${path}.${randomUUID()}.tmp`; await writeFile(temp, content, { encoding: "utf8", flag: "wx" }); await rename(temp, path); }
