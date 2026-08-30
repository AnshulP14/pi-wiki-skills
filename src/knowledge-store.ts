import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ClaimStatus = "current" | "superseded" | "rejected";

export interface EvidenceSource {
	sessionId: string;
	entryIds: string[];
}

export interface Claim {
	id: string;
	title: string;
	content: string;
	sources: EvidenceSource[];
	derivedFrom: string[];
	status: ClaimStatus;
	reason?: string;
}

interface CreateClaimEvent {
	type: "claim-created";
	claim: Claim;
}

interface ClaimStatusEvent {
	type: "claim-status-changed";
	claimId: string;
	status: Exclude<ClaimStatus, "current">;
	reason: string;
}

interface MergeClaimsEvent {
	type: "claims-merged";
	claim: Claim;
	inputIds: string[];
}

export interface SourceAnchor {
	sessionId: string;
	entryId: string;
	contentHash: string;
}

type KnowledgeEvent = CreateClaimEvent | ClaimStatusEvent | MergeClaimsEvent;

export class KnowledgeStore {
	readonly eventsPath: string;
	readonly anchorsPath: string;

	constructor(rootDir: string, projectId: string) {
		const projectDir = join(rootDir, "projects", projectDirectoryName(projectId));
		mkdirSync(projectDir, { recursive: true });
		this.eventsPath = join(projectDir, "events.jsonl");
		this.anchorsPath = join(projectDir, "source-anchors.jsonl");
	}

	createClaim(input: Omit<Claim, "id" | "derivedFrom" | "status">): Claim {
		const claim: Claim = {
			id: randomUUID(),
			title: input.title,
			content: input.content,
			sources: normalizeSources(input.sources),
			derivedFrom: [],
			status: "current",
		};
		this.append({ type: "claim-created", claim });
		return claim;
	}

	mergeClaims(input: { inputIds: string[]; title: string; content: string }): Claim {
		if (input.inputIds.length < 2) throw new Error("A merge requires at least two claims.");
		const claims = input.inputIds.map((id) => this.requireCurrentClaim(id));
		const merged: Claim = {
			id: randomUUID(),
			title: input.title,
			content: input.content,
			sources: normalizeSources(claims.flatMap((claim) => claim.sources)),
			derivedFrom: input.inputIds,
			status: "current",
		};
		this.append({ type: "claims-merged", claim: merged, inputIds: input.inputIds });
		return merged;
	}

	rejectClaim(claimId: string, reason: string): void {
		this.requireCurrentClaim(claimId);
		this.append({ type: "claim-status-changed", claimId, status: "rejected", reason });
	}

	getClaim(claimId: string): Claim | undefined {
		return this.claims().get(claimId);
	}

	currentClaims(): Claim[] {
		return [...this.claims().values()].filter((claim) => claim.status === "current");
	}

	captureAnchors(sessionId: string, entries: { id: string }[]): number {
		const capturedIds = new Set(this.sourceAnchors().map((anchor) => `${anchor.sessionId}\u0000${anchor.entryId}`));
		const unseen = entries.filter((entry) => !capturedIds.has(`${sessionId}\u0000${entry.id}`));
		for (const entry of unseen) {
			const anchor: SourceAnchor = {
				sessionId,
				entryId: entry.id,
				contentHash: createHash("sha256").update(JSON.stringify(entry)).digest("hex"),
			};
			appendFileSync(this.anchorsPath, `${JSON.stringify(anchor)}\n`, "utf8");
		}
		return unseen.length;
	}

	sourceAnchorCount(): number {
		return this.sourceAnchors().length;
	}

	private requireCurrentClaim(claimId: string): Claim {
		const claim = this.getClaim(claimId);
		if (!claim) throw new Error(`Unknown claim '${claimId}'.`);
		if (claim.status !== "current") throw new Error(`Claim '${claimId}' is ${claim.status}.`);
		return claim;
	}

	private claims(): Map<string, Claim> {
		const claims = new Map<string, Claim>();
		for (const event of this.events()) {
			if (event.type === "claim-created") {
				claims.set(event.claim.id, event.claim);
				continue;
			}
			if (event.type === "claims-merged") {
				for (const inputId of event.inputIds) {
					const claim = claims.get(inputId);
					if (!claim || claim.status !== "current") throw new Error(`Merge references non-current claim '${inputId}'.`);
					claims.set(inputId, { ...claim, status: "superseded", reason: `Merged into ${event.claim.id}.` });
				}
				claims.set(event.claim.id, event.claim);
				continue;
			}
			const claim = claims.get(event.claimId);
			if (!claim) throw new Error(`Ledger status event references unknown claim '${event.claimId}'.`);
			claims.set(event.claimId, { ...claim, status: event.status, reason: event.reason });
		}
		return claims;
	}

	private sourceAnchors(): SourceAnchor[] {
		if (!existsSync(this.anchorsPath)) return [];
		return readFileSync(this.anchorsPath, "utf8")
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as SourceAnchor);
	}

	private events(): KnowledgeEvent[] {
		if (!existsSync(this.eventsPath)) return [];
		return readFileSync(this.eventsPath, "utf8")
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as KnowledgeEvent);
	}

	private append(event: KnowledgeEvent): void {
		appendFileSync(this.eventsPath, `${JSON.stringify(event)}\n`, "utf8");
	}
}

function projectDirectoryName(projectId: string): string {
	const normalized = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
	return normalized || "default";
}

function normalizeSources(sources: EvidenceSource[]): EvidenceSource[] {
	const deduplicated = new Map<string, EvidenceSource>();
	for (const source of sources) {
		const entryIds = [...new Set(source.entryIds)];
		const key = `${source.sessionId}\u0000${entryIds.join("\u0000")}`;
		if (!deduplicated.has(key)) deduplicated.set(key, { sessionId: source.sessionId, entryIds });
	}
	return [...deduplicated.values()];
}
