import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { KnowledgeStore } from "../src/knowledge-store.ts";

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

test("captures each session entry once without overwriting its first snapshot", () => {
	const store = new KnowledgeStore(root, "example-project");
	const first = { id: "entry-1", message: "initial" };
	assert.equal(store.captureEntries("session-a", [first]), 1);
	assert.equal(store.captureEntries("session-a", [{ id: "entry-1", message: "changed" }, { id: "entry-2" }]), 1);

	const tracePath = join(store.tracesDir, readdirSync(store.tracesDir)[0]);
	const records = readFileSync(tracePath, "utf8")
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line));
	assert.deepEqual(records, [
		{ sessionId: "session-a", entryId: "entry-1", entry: first },
		{ sessionId: "session-a", entryId: "entry-2", entry: { id: "entry-2" } },
	]);
	assert.equal(store.capturedEntryCount(), 2);
});

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
