import { createHash } from "node:crypto";

import type { SurfaceMcpDrawingGovernanceClient } from "@ai-assist/adapters";

interface AvailableTool {
	readonly name: string;
	readonly tags: readonly string[];
	readonly description: string;
}

interface ToolInvoker {
	readonly tools: readonly AvailableTool[];
	invoke(name: string, input: object): Promise<{ readonly text: string }>;
}

interface ReconcileCapableSurfaceClient extends SurfaceMcpDrawingGovernanceClient {
	readonly listCommentsForReconcile?: (workItemReference: string) => Promise<Array<{ readonly commentReference: string; readonly version: string; readonly content: string }>>;
}

const TOOL_SUFFIXES = {
	createWorkItem: "p_create_work_item",
	getWorkItem: "p_get_work_item",
	listComments: "p_list_work_item_comments",
	updateWorkItem: "p_update_work_item",
} as const;

const CANONICAL_MARKER_PATTERN = /<!--\s*([^\r\n<>]+?)\s*-->/gu;

const DEFAULT_CREATE_TARGET = {
	organization: "MSFTDEVICES",
	project: "Project A",
	workItemType: "Task",
} as const;

export function createSurfaceHostClient(surface: ToolInvoker): SurfaceMcpDrawingGovernanceClient {
	const tools = {
		createWorkItem: resolveOptionalTool(surface.tools, TOOL_SUFFIXES.createWorkItem),
		getWorkItem: resolveRequiredTool(surface.tools, TOOL_SUFFIXES.getWorkItem),
		listComments: resolveRequiredTool(surface.tools, TOOL_SUFFIXES.listComments),
		updateWorkItem: resolveRequiredTool(surface.tools, TOOL_SUFFIXES.updateWorkItem),
	};

	const invoke = async (name: string, input: object): Promise<Record<string, unknown>> => {
		const response = await surface.invoke(name, input);
		const parsed = JSON.parse(response.text) as unknown;
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("Surface MCP tool returned invalid structured content.");
		}
		return parsed as Record<string, unknown>;
	};

	const listCommentsForReconcile = async (reference: string): Promise<Array<{ readonly commentReference: string; readonly version: string; readonly content: string }>> => {
		const target = parseAdoWorkItemUrl(reference);
		const comments = readComments(await invoke(tools.listComments, {
			organization: target.organization,
			project: target.project,
			work_item_id: target.workItemId,
			top: 200,
		}));
		return comments.map((comment) => ({
			commentReference: String(comment.id),
			version: String(comment.version),
			content: normalizeText(comment.text),
		}));
	};

	const client: ReconcileCapableSurfaceClient = {
		async listCapabilities() {
			return tools.createWorkItem === undefined
				? ["workItems.read", "workItems.comments.read", "workItems.comments.update"]
				: ["workItems.create", "workItems.read", "workItems.comments.read", "workItems.comments.update"];
		},

		async createWorkItem(input) {
			if (tools.createWorkItem === undefined) {
				throw new Error("Surface MCP create Work Item capability is unavailable.");
			}
			const result = await invoke(tools.createWorkItem, {
				organization: DEFAULT_CREATE_TARGET.organization,
				project: DEFAULT_CREATE_TARGET.project,
				workItemType: DEFAULT_CREATE_TARGET.workItemType,
				requestBody: [
					{ name: "System.Title", value: input.title },
					{ name: "System.AssignedTo", value: input.sponsorEmail },
				],
			});
			const workItemId = requiredNumber(result, "id");
			if (!Number.isInteger(workItemId) || workItemId <= 0) {
				throw new Error("Surface MCP create Work Item result is invalid.");
			}
			return {
				workItemReference: buildAdoWorkItemUrl(
					DEFAULT_CREATE_TARGET.organization,
					DEFAULT_CREATE_TARGET.project,
					workItemId,
				),
			};
		},

		async readWorkItem(reference) {
			const target = parseAdoWorkItemUrl(reference);
			const result = await invoke(tools.getWorkItem, {
				organization: target.organization,
				project: target.project,
				work_item_id: target.workItemId,
				expand: "fields",
			});
			if (requiredNumber(result, "id") !== target.workItemId) {
				throw new Error("Surface MCP Work Item readback identity does not match the validation target.");
			}
			const fields = record(result.fields, "fields");
			const title = typeof fields["System.Title"] === "string" ? fields["System.Title"] : undefined;
			const ownerReference = identity(fields["System.AssignedTo"]);
			const requestByReference = identity(fields["System.CreatedBy"]);
			return {
				version: String(requiredNumber(result, "rev")),
				targetIdentity: target,
				...(title === undefined ? {} : { title }),
				...(ownerReference === undefined ? {} : { ownerReference }),
				...(requestByReference === undefined ? {} : { requestByReference }),
			};
		},

		async readCommentZero(reference) {
			const comments = await listCommentsForReconcile(reference);
			const latest = comments.at(-1);
			return latest === undefined
				? { commentReference: "new", version: "0", content: "" }
				: { commentReference: latest.commentReference, version: latest.version, content: latest.content };
		},

		async updateCommentZero(input) {
			const target = parseAdoWorkItemUrl(input.workItemReference);
			const before = readComments(await invoke(tools.listComments, {
				organization: target.organization,
				project: target.project,
				work_item_id: target.workItemId,
				top: 200,
			}));
			await invoke(tools.updateWorkItem, {
				organization: target.organization,
				work_item_id: target.workItemId,
				requestBody: [{ op: "add", path: "/fields/System.History", value: input.content }],
			});
			const after = readComments(await invoke(tools.listComments, {
				organization: target.organization,
				project: target.project,
				work_item_id: target.workItemId,
				top: 200,
			}));
			const beforeIds = new Set(before.map(({ id }) => id));
			const added = after.filter(({ id, text }) => !beforeIds.has(id) && normalizeText(text) === normalizeText(input.content));
			if (added.length !== 1) {
				throw new Error("Surface MCP write readback did not contain exactly one matching comment.");
			}
			return { version: String(added[0]!.version) };
		},
		listCommentsForReconcile,
	};

	return client;
}

function resolveRequiredTool(tools: readonly AvailableTool[], suffix: string): string {
	const matches = matchSurfaceTools(tools, suffix);
	if (matches.length !== 1) {
		throw new Error(`Surface MCP ${suffix} tool is ${matches.length === 0 ? "missing" : "ambiguous"}.`);
	}
	return matches[0]!.name;
}

function resolveOptionalTool(tools: readonly AvailableTool[], suffix: string): string | undefined {
	const matches = matchSurfaceTools(tools, suffix);
	if (matches.length > 1) {
		throw new Error(`Surface MCP ${suffix} tool is ambiguous.`);
	}
	return matches[0]?.name;
}

function matchSurfaceTools(tools: readonly AvailableTool[], suffix: string): readonly AvailableTool[] {
	return tools.filter((tool) =>
		(tool.tags.includes("surface-mcp") || tool.name.toLowerCase().includes("surface_mcp"))
		&& tool.name.endsWith(suffix),
	);
}

function buildAdoWorkItemUrl(organization: string, project: string, workItemId: number): string {
	return `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_workitems/edit/${workItemId}`;
}

export function parseAdoWorkItemUrl(value: string): { readonly organization: string; readonly project: string; readonly workItemId: number } {
	const url = new URL(value);
	const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
	const marker = segments.findIndex((segment, index) => segment.toLowerCase() === "_workitems" && segments[index + 1]?.toLowerCase() === "edit");
	const organization = url.hostname.toLowerCase() === "dev.azure.com" ? segments[0] : url.hostname.split(".")[0];
	const project = url.hostname.toLowerCase() === "dev.azure.com" ? segments[1] : segments[0];
	const workItemId = marker < 0 ? Number.NaN : Number(segments[marker + 2]);
	if (url.protocol !== "https:" || organization === undefined || project === undefined || !Number.isInteger(workItemId) || workItemId <= 0) {
		throw new Error("Existing Work Item reference must be a complete Azure DevOps URL.");
	}
	return { organization, project, workItemId };
}

function record(value: unknown, label: string): Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Surface MCP ${label} is invalid.`);
	}
	return value as Record<string, unknown>;
}

function requiredNumber(value: Record<string, unknown>, key: string): number {
	const candidate = value[key];
	if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
		throw new Error(`Surface MCP ${key} is invalid.`);
	}
	return candidate;
}

function identity(value: unknown): string | undefined {
	if (typeof value === "string" && value.length > 0) {
		return value;
	}
	if (value !== null && typeof value === "object") {
		const candidate = value as Record<string, unknown>;
		for (const key of ["uniqueName", "displayName", "id"]) {
			if (typeof candidate[key] === "string" && candidate[key].length > 0) {
				return candidate[key] as string;
			}
		}
	}
	return undefined;
}

function readComments(value: Record<string, unknown>): Array<{ readonly id: number; readonly version: number; readonly text: string }> {
	const entries = Array.isArray(value.comments) ? value.comments : Array.isArray(value.value) ? value.value : [];
	return entries
		.map((entry) => record(entry, "comment"))
		.map((entry) => ({
			id: requiredNumber(entry, "id"),
			version: typeof entry.version === "number" ? entry.version : 1,
			text: typeof entry.text === "string" ? entry.text : typeof entry.content === "string" ? entry.content : "",
		}));
}

function normalizeText(value: string): string {
	return value.replace(/\r\n/g, "\n").trimEnd();
}

export const ADO_WORK_ITEM_PATH_MARKER = "_workitems/edit";

export interface SurfaceWriteReconcileRequest {
	readonly workItemReference: string;
	readonly previewMarker: string;
	readonly previewHash: string;
	readonly expectedTarget: {
		readonly organization: string;
		readonly project: string;
		readonly workItemId: number;
	};
}

export type SurfaceWriteReconcileResult =
	| {
			readonly state: "completed";
			readonly writeReplayed: false;
			readonly observedCommentReference: string;
			readonly observedCommentVersion: string;
	  }
	| {
			readonly state: "absent";
	  }
	| {
			readonly state: "blocked";
			readonly reasonCode: "target_mismatch" | "inconclusive" | "preview_hash_mismatch";
			readonly reason: string;
	  };

export async function reconcileSurfaceWrite(
	client: SurfaceMcpDrawingGovernanceClient,
	request: SurfaceWriteReconcileRequest,
): Promise<SurfaceWriteReconcileResult> {
	const observedTarget = parseAdoWorkItemUrl(request.workItemReference);
	if (
		observedTarget.organization !== request.expectedTarget.organization
		|| observedTarget.project !== request.expectedTarget.project
		|| observedTarget.workItemId !== request.expectedTarget.workItemId
	) {
		return {
			state: "blocked",
			reasonCode: "target_mismatch",
			reason: "The current work item target does not match the confirmed write target.",
		};
	}

	const reconcileClient = client as ReconcileCapableSurfaceClient;
	const comments = reconcileClient.listCommentsForReconcile === undefined
		? normalizeComments(await client.readCommentZero(request.workItemReference))
		: await reconcileClient.listCommentsForReconcile(request.workItemReference);
	const matches = comments.filter((comment) => hasCanonicalPreviewMarker(comment.content, request.previewMarker));
	if (matches.length === 0) {
		return { state: "absent" };
	}
	if (matches.length > 1) {
		return {
			state: "blocked",
			reasonCode: "inconclusive",
			reason: "Multiple matching preview markers were found; reconciliation is inconclusive.",
		};
	}

	const match = matches[0]!;
	if (sha256(normalizeText(match.content)) !== request.previewHash) {
		return {
			state: "blocked",
			reasonCode: "preview_hash_mismatch",
			reason: "A matching marker was found, but the comment content hash no longer matches the confirmed preview.",
		};
	}

	return {
		state: "completed",
		writeReplayed: false,
		observedCommentReference: match.commentReference,
		observedCommentVersion: match.version,
	};
}

function normalizeComments(comment: { readonly commentReference: string; readonly version: string; readonly content: string }): Array<{ readonly commentReference: string; readonly version: string; readonly content: string }> {
	return [{
		commentReference: comment.commentReference,
		version: comment.version,
		content: normalizeText(comment.content),
	}];
}

function hasCanonicalPreviewMarker(content: string, marker: string): boolean {
	for (const match of content.matchAll(CANONICAL_MARKER_PATTERN)) {
		if (match[1]?.trim() === marker) return true;
	}
	return false;
}

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}