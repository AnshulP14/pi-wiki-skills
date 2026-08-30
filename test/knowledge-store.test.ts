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

test("resolves source anchors from their recorded Pi session file and rejects altered evidence", () => {
	const store = new KnowledgeStore(root, "example-project");
	const sessionFile = join(root, "session.jsonl");
	const entry = { type: "message", id: "entry-1", parentId: null, timestamp: "2026-01-01T00:00:00.000Z", message: "initial" };
	writeSessionFile(sessionFile, "session-a", [entry]);
	store.captureAnchors(sessionFile, "session-a", [entry]);
	const [anchor] = store.sourceAnchors();
	assert.ok(anchor);

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

test("project identifiers cannot escape the store root", () => {
	const store = new KnowledgeStore(root, "../../outside");
	assert.match(store.anchorsPath, new RegExp(`^${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
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
