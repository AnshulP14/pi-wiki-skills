import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { KnowledgeStore } from "../src/knowledge-store.ts";
import { hashSourceEntry, resolveSourceAnchor } from "../src/source-resolver.ts";

let root = "";

test.beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "pi-wiki-skills-"));
});

test.afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

test("merging claims preserves every source and atomically supersedes inputs", () => {
	const store = new KnowledgeStore(root, "example-project");
	const first = store.createClaim({
		title: "Compaction order",
		content: "Hermes flushes before Blackhole compacts.",
		sources: [{ sessionId: "session-a", entryIds: ["entry-1", "entry-2"] }],
	});
	const second = store.createClaim({
		title: "Compaction order",
		content: "Restart Pi after extension load-order changes.",
		sources: [{ sessionId: "session-b", entryIds: ["entry-3"] }],
	});

	const merged = store.mergeClaims({
		inputIds: [first.id, second.id],
		title: "Compaction extension order",
		content: "Hermes flushes before Blackhole compacts; restart Pi after changing load order.",
	});

	assert.deepEqual(merged.derivedFrom, [first.id, second.id]);
	assert.deepEqual(merged.sources, [
		{ sessionId: "session-a", entryIds: ["entry-1", "entry-2"] },
		{ sessionId: "session-b", entryIds: ["entry-3"] },
	]);
	assert.equal(store.getClaim(first.id)?.status, "superseded");
	assert.equal(store.getClaim(second.id)?.status, "superseded");
	assert.equal(store.getClaim(merged.id)?.status, "current");
	assert.deepEqual(
		readFileSync(store.eventsPath, "utf8")
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line).type),
		["claim-created", "claim-created", "claims-merged"],
	);
});

test("reopening the store reconstructs current and superseded claims from its append-only ledger", () => {
	const store = new KnowledgeStore(root, "example-project");
	const claim = store.createClaim({
		title: "Project purpose",
		content: "Build an evidence-backed Pi extension.",
		sources: [{ sessionId: "session-a", entryIds: ["entry-1"] }],
	});
	store.rejectClaim(claim.id, "Task status is not durable knowledge.");

	const reopened = new KnowledgeStore(root, "example-project");
	assert.deepEqual(reopened.getClaim(claim.id), {
		...claim,
		status: "rejected",
		reason: "Task status is not durable knowledge.",
	});
	assert.deepEqual(reopened.currentClaims(), []);
});

test("records each session entry once as a source anchor without copying its content", () => {
	const store = new KnowledgeStore(root, "example-project");
	const sessionFile = join(root, "session.jsonl");
	const first = { id: "entry-1", message: "initial" };
	assert.equal(store.captureAnchors(undefined, "in-memory", [first]), 0);
	writeSessionFile(sessionFile, "session-a", [first, { id: "entry-2" }]);
	assert.equal(store.captureAnchors(sessionFile, "session-a", [first]), 1);
	assert.equal(store.captureAnchors(sessionFile, "session-a", [{ id: "entry-1", message: "changed" }, { id: "entry-2" }]), 1);

	const anchors = readFileSync(store.anchorsPath, "utf8")
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line));
	assert.deepEqual(anchors, [
		{
			sessionFile,
			sessionId: "session-a",
			entryId: "entry-1",
			contentHash: hashSourceEntry(first),
		},
		{
			sessionFile,
			sessionId: "session-a",
			entryId: "entry-2",
			contentHash: hashSourceEntry({ id: "entry-2" }),
		},
	]);
	assert.equal(store.sourceAnchorCount(), 2);
});

test("resolves source anchors from Pi session files and rejects unavailable or altered evidence", () => {
	const store = new KnowledgeStore(root, "example-project");
	const sessionFile = join(root, "session.jsonl");
	const entry = { type: "message", id: "entry-1", parentId: null, timestamp: "2026-01-01T00:00:00.000Z", message: "initial" };
	writeSessionFile(sessionFile, "session-a", [entry]);
	store.captureAnchors(sessionFile, "session-a", [entry]);
	const anchor = store.sourceAnchors()[0];

	assert.deepEqual(resolveSourceAnchor(anchor), { anchor, status: "verified", entry });
	writeSessionFile(sessionFile, "session-a", [{ message: "initial", timestamp: entry.timestamp, parentId: null, id: "entry-1", type: "message" }]);
	assert.equal(resolveSourceAnchor(anchor).status, "verified");
	writeSessionFile(sessionFile, "session-a", [{ ...entry, message: "changed" }]);
	assert.equal(resolveSourceAnchor(anchor).status, "content-mismatch");
	writeSessionFile(sessionFile, "session-a", []);
	assert.equal(resolveSourceAnchor(anchor).status, "missing-entry");
	writeSessionFile(sessionFile, "session-other", [entry]);
	assert.equal(resolveSourceAnchor(anchor).status, "session-id-mismatch");
	assert.equal(resolveSourceAnchor({ ...anchor, sessionFile: join(root, "missing.jsonl") }).status, "missing-session");
});

function writeSessionFile(sessionFile: string, sessionId: string, entries: Record<string, unknown>[]): void {
	writeFileSync(
		sessionFile,
		[
			JSON.stringify({ type: "session", version: 3, id: sessionId, timestamp: "2026-01-01T00:00:00.000Z", cwd: root }),
			...entries.map((entry) => JSON.stringify(entry)),
		].join("\n") + "\n",
	);
}

test("project identifiers cannot escape the store root", () => {
	const store = new KnowledgeStore(root, "../../outside");
	const claim = store.createClaim({
		title: "Safe path",
		content: "Project files remain below the configured root.",
		sources: [{ sessionId: "session-a", entryIds: ["entry-1"] }],
	});

	assert.equal(store.getClaim(claim.id)?.title, "Safe path");
	assert.match(store.eventsPath, new RegExp(`^${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
});
