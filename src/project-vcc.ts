import type { SourceAnchor } from "./knowledge-store.ts";
import type { SourceResolution } from "./source-resolver.ts";

const ENTRIES_PER_DIGEST = 30;
const MAX_ENTRY_CHARS = 180;
const MAX_ASSISTANT_CHARS = 2_000;

export interface ProjectDigest {
	anchors: SourceAnchor[];
	excerpt: string;
}

/**
 * Deterministic, provenance-preserving VCC-style compaction. Every verified
 * entry contributes a clipped line; the source anchors remain available for
 * review and pattern citations.
 */
export function compactProjectEntries(resolutions: SourceResolution[]): ProjectDigest[] {
	const verified = resolutions.filter(
		(resolution): resolution is SourceResolution & { entry: Record<string, unknown> } =>
			resolution.status === "verified" && resolution.entry !== undefined,
	);
	const digests: ProjectDigest[] = [];
	for (let offset = 0; offset < verified.length; offset += ENTRIES_PER_DIGEST) {
		const batch = verified.slice(offset, offset + ENTRIES_PER_DIGEST);
		digests.push({
			anchors: batch.map(({ anchor }) => anchor),
			excerpt: formatDigest(batch),
		});
	}
	return digests;
}

function formatDigest(batch: (SourceResolution & { entry: Record<string, unknown> })[]): string {
	const sessionId = batch[0]?.anchor.sessionId ?? "unknown";
	const files = new Set<string>();
	const lines = batch.flatMap(({ anchor, entry }) => {
		const text = describeEntry(entry);
		for (const file of text.matchAll(/(?:[\w.-]+\/)+[\w.-]+|\b[\w.-]+\.(?:ts|tsx|js|jsx|json|md|sh|py)\b/g)) {
			files.add(file[0]);
		}
		return text ? [`- [${sourceRef(anchor)}] ${text}`] : [];
	});
	return [
		`## Session ${sessionId}`,
		`**Entries:** ${batch.length}`,
		...(files.size ? [`**Files mentioned:** ${[...files].slice(0, 12).join(", ")}`] : []),
		"**Compressed trace:**",
		...lines,
	].join("\n");
}

function describeEntry(entry: Record<string, unknown>): string {
	if (entry.type === "compaction" || entry.type === "branch_summary") return "";
	if (entry.type !== "message" || !isRecord(entry.message)) return "";
	const role = typeof entry.message.role === "string" ? entry.message.role : "message";
	if (role === "bashExecution" && typeof entry.message.command === "string") {
		const output = typeof entry.message.output === "string" ? `: ${entry.message.output}` : "";
		const exitCode = typeof entry.message.exitCode === "number" ? ` (exit ${entry.message.exitCode})` : "";
		return `bash${exitCode}: ${clip(entry.message.command + output)}`;
	}
	const text = messageText(entry.message.content);
	return text ? `${role}: ${clip(text, role === "assistant" ? MAX_ASSISTANT_CHARS : MAX_ENTRY_CHARS)}` : "";
}

function messageText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.flatMap((part) => {
			if (!isRecord(part)) return [];
			if (part.type === "text" && typeof part.text === "string") return [part.text];
			if (part.type === "toolCall" && typeof part.name === "string") return [`tool: ${part.name}`];
			return [];
		})
		.join(" ");
}

function clip(text: string, maxChars = MAX_ENTRY_CHARS): string {
	return text.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sourceRef(anchor: SourceAnchor): string {
	return `${anchor.sessionId}/${anchor.entryId}`;
}
