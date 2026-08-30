import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SourceAnchor } from "./knowledge-store.ts";

export type SourceResolutionStatus =
	| "verified"
	| "missing-session"
	| "unreadable-session"
	| "invalid-session"
	| "session-id-mismatch"
	| "missing-entry"
	| "content-mismatch";

export interface SourceResolution {
	anchor: SourceAnchor;
	status: SourceResolutionStatus;
	entry?: Record<string, unknown>;
}

export function hashSourceEntry(entry: unknown): string {
	const serialized = JSON.stringify(entry);
	if (serialized === undefined) throw new Error("Cannot hash an undefined source entry.");
	return createHash("sha256").update(canonicalJson(JSON.parse(serialized) as unknown)).digest("hex");
}

export function resolveSourceAnchor(anchor: SourceAnchor): SourceResolution {
	const sessionFile = resolve(anchor.sessionFile);
	if (!existsSync(sessionFile)) return { anchor, status: "missing-session" };

	let content: string;
	try {
		content = readFileSync(sessionFile, "utf8");
	} catch {
		return { anchor, status: "unreadable-session" };
	}

	const entries: unknown[] = [];
	for (const line of content.split("\n")) {
		if (!line.trim()) continue;
		try {
			entries.push(JSON.parse(line) as unknown);
		} catch {
			// Match Pi's session parser: malformed lines do not invalidate other entries.
		}
	}

	const header = entries[0];
	if (!isSessionHeader(header)) return { anchor, status: "invalid-session" };
	if (header.id !== anchor.sessionId) return { anchor, status: "session-id-mismatch" };

	const entry = entries.find((candidate) => isSessionEntry(candidate) && candidate.id === anchor.entryId);
	if (!entry) return { anchor, status: "missing-entry" };
	if (hashSourceEntry(entry) !== anchor.contentHash) return { anchor, status: "content-mismatch" };
	return { anchor, status: "verified", entry };
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value === "boolean" || typeof value === "string" || typeof value === "number") {
		const serialized = JSON.stringify(value);
		if (serialized === undefined) throw new Error("Source entries must be JSON values.");
		return serialized;
	}
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (typeof value === "object") {
		return `{${Object.entries(value)
			.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
			.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
			.join(",")}}`;
	}
	throw new Error("Source entries must be JSON values.");
}

function isSessionHeader(value: unknown): value is { type: "session"; id: string } {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		value.type === "session" &&
		typeof value.id === "string"
	);
}

function isSessionEntry(value: unknown): value is Record<string, unknown> & { id: string } {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		value.type !== "session" &&
		typeof value.id === "string"
	);
}
