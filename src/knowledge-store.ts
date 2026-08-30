import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { hashSourceEntry } from "./source-resolver.ts";

export interface SourceAnchor {
	sessionFile: string;
	sessionId: string;
	entryId: string;
	contentHash: string;
}

export class KnowledgeStore {
	readonly projectDir: string;
	readonly anchorsPath: string;

	constructor(rootDir: string, projectId: string) {
		this.projectDir = join(rootDir, "projects", projectDirectoryName(projectId));
		mkdirSync(this.projectDir, { recursive: true });
		this.anchorsPath = join(this.projectDir, "source-anchors.jsonl");
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

	sourceAnchorCount(): number {
		return this.sourceAnchors().length;
	}

	sourceAnchors(): SourceAnchor[] {
		if (!existsSync(this.anchorsPath)) return [];
		return readFileSync(this.anchorsPath, "utf8")
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as SourceAnchor);
	}
}

function projectDirectoryName(projectId: string): string {
	const normalized = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
	return normalized || "default";
}
