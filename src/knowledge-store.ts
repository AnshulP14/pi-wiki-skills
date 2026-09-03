import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { WikiChange } from "./dream.ts";
import { hashSourceEntry } from "./source-resolver.ts";

export interface SourceAnchor {
	sessionFile: string;
	sessionId: string;
	entryId: string;
	contentHash: string;
}

export type DreamRunStatus = "approved" | "rejected" | "no-pattern";

interface DreamRun {
	id: string;
	timestamp: string;
	status: DreamRunStatus;
	anchorKeys: string[];
}

export interface ApprovalClaim {
	id: string;
	timestamp: string;
	change: WikiChange;
}

export interface ApprovalDecision {
	claimId: string;
	timestamp: string;
	status: "approved" | "rejected";
}

export class KnowledgeStore {
	readonly projectDir: string;
	readonly anchorsPath: string;
	readonly dreamRunsPath: string;
	readonly approvalClaimsPath: string;
	readonly projectId: string;

	constructor(rootDir: string, projectId: string) {
		this.projectId = projectId;
		this.projectDir = join(rootDir, "projects", projectDirectoryName(projectId));
		mkdirSync(this.projectDir, { recursive: true });
		this.anchorsPath = join(this.projectDir, "source-anchors.jsonl");
		this.dreamRunsPath = join(this.projectDir, "dream-runs.jsonl");
		this.approvalClaimsPath = join(this.projectDir, "approval-claims.jsonl");
	}

	captureAnchors(sessionFile: string | undefined, sessionId: string, entries: { id: string }[]): number {
		if (!sessionFile) return 0;
		const capturedIds = new Set(this.sourceAnchors().map((anchor) => `${anchor.sessionId}\u0000${anchor.entryId}`));
		const unseen = entries.filter((entry) => !capturedIds.has(`${sessionId}\u0000${entry.id}`));
		for (const entry of unseen) {
			const anchor: SourceAnchor = {
				sessionFile: resolve(sessionFile),
				sessionId,
				entryId: entry.id,
				contentHash: hashSourceEntry(entry),
			};
			appendFileSync(this.anchorsPath, `${JSON.stringify(anchor)}\n`, "utf8");
		}
		return unseen.length;
	}

	/** Backfill every readable Pi session whose header identifies this project. */
	captureProjectAnchors(sessionsDir: string): number {
		let captured = 0;
		for (const sessionFile of sessionFiles(sessionsDir)) {
			const session = readSession(sessionFile);
			if (!session || session.cwd !== this.projectId) continue;
			captured += this.captureAnchors(sessionFile, session.id, session.entries);
		}
		return captured;
	}

	recordDreamRun(status: DreamRunStatus, anchors: SourceAnchor[]): void {
		const run: DreamRun = {
			id: crypto.randomUUID(),
			timestamp: new Date().toISOString(),
			status,
			anchorKeys: anchors.map(sourceAnchorKey),
		};
		appendFileSync(this.dreamRunsPath, `${JSON.stringify(run)}\n`, "utf8");
	}

	recordApprovalClaims(changes: WikiChange[]): ApprovalClaim[] {
		const claims = changes.map((change) => ({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), change }));
		for (const claim of claims) appendFileSync(this.approvalClaimsPath, `${JSON.stringify(claim)}\n`, "utf8");
		return claims;
	}

	recordApprovalDecision(claimId: string, status: ApprovalDecision["status"]): void {
		appendFileSync(this.approvalClaimsPath, `${JSON.stringify({ claimId, timestamp: new Date().toISOString(), status })}\n`, "utf8");
	}

	approvalClaims(): (ApprovalClaim | ApprovalDecision)[] {
		if (!existsSync(this.approvalClaimsPath)) return [];
		return readJsonLines(this.approvalClaimsPath).filter(isApprovalLedgerEntry);
	}

	reviewedAnchorKeys(): Set<string> {
		return new Set(this.dreamRuns().flatMap((run) => run.anchorKeys));
	}

	sourceAnchorCount(): number {
		return this.sourceAnchors().length;
	}

	sourceAnchors(): SourceAnchor[] {
		if (!existsSync(this.anchorsPath)) return [];
		return readJsonLines(this.anchorsPath).filter(isSourceAnchor);
	}

	private dreamRuns(): DreamRun[] {
		if (!existsSync(this.dreamRunsPath)) return [];
		return readJsonLines(this.dreamRunsPath).filter(isDreamRun);
	}
}

export function sourceAnchorKey(anchor: SourceAnchor): string {
	return `${anchor.sessionId}\u0000${anchor.entryId}\u0000${anchor.contentHash}`;
}

function sessionFiles(directory: string): string[] {
	if (!existsSync(directory)) return [];
	let entries;
	try {
		entries = readdirSync(directory, { withFileTypes: true });
	} catch {
		return [];
	}
	const paths: string[] = [];
	for (const entry of entries) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) paths.push(...sessionFiles(path));
		else if (entry.isFile() && entry.name.endsWith(".jsonl")) paths.push(path);
	}
	return paths.sort();
}

function readSession(sessionFile: string): { id: string; cwd: string; entries: { id: string }[] } | undefined {
	let content: string;
	try {
		content = readFileSync(sessionFile, "utf8");
	} catch {
		return undefined;
	}
	const values = content
		.split("\n")
		.flatMap((line) => {
			try {
				return line.trim() ? [JSON.parse(line) as unknown] : [];
			} catch {
				return [];
			}
		});
	const header = values[0];
	if (!isSessionHeader(header)) return undefined;
	return { id: header.id, cwd: header.cwd, entries: values.slice(1).filter(isSessionEntry) };
}

function readJsonLines(path: string): unknown[] {
	return readFileSync(path, "utf8")
		.split("\n")
		.flatMap((line) => {
			try {
				return line.trim() ? [JSON.parse(line) as unknown] : [];
			} catch {
				return [];
			}
		});
}

function isSessionHeader(value: unknown): value is { type: "session"; id: string; cwd: string } {
	return isRecord(value) && value.type === "session" && typeof value.id === "string" && typeof value.cwd === "string";
}

function isSessionEntry(value: unknown): value is { id: string } {
	return isRecord(value) && value.type !== "session" && typeof value.id === "string";
}

function isSourceAnchor(value: unknown): value is SourceAnchor {
	return isRecord(value) && typeof value.sessionFile === "string" && typeof value.sessionId === "string" && typeof value.entryId === "string" && typeof value.contentHash === "string";
}

function isApprovalLedgerEntry(value: unknown): value is ApprovalClaim | ApprovalDecision {
	return (
		isRecord(value) &&
		typeof value.timestamp === "string" &&
		((typeof value.id === "string" && isRecord(value.change)) ||
			(typeof value.claimId === "string" && (value.status === "approved" || value.status === "rejected")))
	);
}

function isDreamRun(value: unknown): value is DreamRun {
	return isRecord(value) && typeof value.id === "string" && typeof value.timestamp === "string" && (value.status === "approved" || value.status === "rejected" || value.status === "no-pattern") && Array.isArray(value.anchorKeys) && value.anchorKeys.every((key) => typeof key === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function projectDirectoryName(projectId: string): string {
	const normalized = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
	return normalized || "default";
}
