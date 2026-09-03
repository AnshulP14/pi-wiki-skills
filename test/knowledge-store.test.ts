import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildWikiCatalog, parseSessionStep, parseWikiChanges, selectDreamSessions } from "../src/dream.ts";
import { KnowledgeStore } from "../src/knowledge-store.ts";
import { hashSourceEntry, resolveSourceAnchor } from "../src/source-resolver.ts";
import { WikiStore } from "../src/wiki-store.ts";

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

test("compacts verified entries by session into provenance-backed dream input", () => {
	const first = { type: "message", id: "entry-1", message: "a".repeat(10_000) };
	const second = { type: "message", id: "entry-2", message: "b".repeat(10_000) };
	const sessions = selectDreamSessions(
		[first, second].map((entry, index) => ({
			anchor: { sessionFile: join(root, "session.jsonl"), sessionId: index ? "session-b" : "session-a", entryId: entry.id, contentHash: hashSourceEntry(entry) },
			status: "verified" as const,
			entry,
		})),
		new Set(),
	);
	assert.equal(sessions.length, 2);
	assert.match(sessions[0]?.evidence[0]?.excerpt ?? "", /Session session-a/);
	assert.ok((sessions[0]?.evidence[0]?.excerpt.length ?? 0) < 1_000);
});

test("keeps assistant final messages longer than ordinary VCC entries", () => {
	const entries = [
		{ type: "message", id: "assistant", message: { role: "assistant", content: [{ type: "text", text: "a".repeat(500) }] } },
		{ type: "message", id: "user", message: { role: "user", content: [{ type: "text", text: "b".repeat(500) }] } },
	];
	const sessions = selectDreamSessions(
		entries.map((entry) => ({
			anchor: { sessionFile: join(root, "session.jsonl"), sessionId: "session-a", entryId: entry.id, contentHash: hashSourceEntry(entry) },
			status: "verified" as const,
			entry,
		})),
		new Set(),
	);
	const excerpt = sessions[0]?.evidence[0]?.excerpt ?? "";
	assert.match(excerpt, new RegExp(`assistant: ${"a".repeat(500)}`));
	assert.doesNotMatch(excerpt, new RegExp(`b{${181}}`));
});

test("backfills project session entries and excludes a completed dream batch", () => {
	const sessions = join(root, "sessions");
	const projectSession = join(sessions, "project", "session.jsonl");
	const otherSession = join(sessions, "other", "session.jsonl");
	writeSessionFile(projectSession, "session-a", [{ id: "entry-1", type: "message", message: { role: "user", content: "Add a test." } }], "example-project");
	writeSessionFile(otherSession, "session-b", [{ id: "entry-2", type: "message", message: { role: "user", content: "Ignore me." } }], "another-project");
	const store = new KnowledgeStore(root, "example-project");
	assert.equal(store.captureProjectAnchors(sessions), 1);
	assert.equal(store.captureProjectAnchors(sessions), 0);
	const anchors = store.sourceAnchors();
	assert.equal(anchors.length, 1);
	store.recordDreamRun("no-pattern", anchors);
	assert.equal(selectDreamSessions(anchors.map(resolveSourceAnchor), store.reviewedAnchorKeys()).length, 0);
});

test("loads one wiki page per Dream step and validates create, update, and delete changes", () => {
	const entry = { type: "message", id: "entry-1", message: "fixed the issue" };
	const anchor = {
		sessionFile: join(root, "session.jsonl"),
		sessionId: "session-a",
		entryId: entry.id,
		contentHash: hashSourceEntry(entry),
	};
	const evidence = selectDreamSessions([{ anchor, status: "verified", entry }], new Set())[0]?.evidence ?? [];
	const wiki = new WikiStore(join(root, "project"));
	const id = wiki.createPattern({ title: "Existing", rule: "Old rule.", why: "Old why.", exceptions: "None.", sources: [{ sessionId: "session-a", entryIds: ["entry-1"] }] });
	const secondId = wiki.createPattern({ title: "Second", rule: "Second rule.", why: "Second why.", exceptions: "None.", sources: [{ sessionId: "session-a", entryIds: ["entry-1"] }] });
	const pages = wiki.patternPages();
	const firstPage = pages.find((page) => page.id === id);
	const secondPage = pages.find((page) => page.id === secondId);
	assert.ok(firstPage && secondPage);
	assert.match(buildWikiCatalog(pages), new RegExp(id));
	const firstStep = parseSessionStep(JSON.stringify({ changes: [], nextPageId: id }), evidence, undefined, pages, new Set());
	assert.equal(firstStep?.nextPage, firstPage);
	const nextStep = parseSessionStep(JSON.stringify({ changes: [], nextPageId: secondId }), evidence, firstPage, pages, new Set([id]));
	assert.equal(nextStep?.nextPage, secondPage);

	const step = parseSessionStep(
		JSON.stringify({ changes: [{ action: "update", targetId: secondId, title: "Updated", rule: "New rule.", why: "New why.", exceptions: "None.", sources: ["session-a/entry-1"] }], nextPageId: null }),
		evidence,
		secondPage,
		pages,
		new Set([id, secondId]),
	);
	const change = step?.changes[0];
	assert.ok(change && change.action === "update");
	assert.equal(parseSessionStep(JSON.stringify({ changes: [], nextPageId: id }), evidence, secondPage, pages, new Set([id, secondId])), undefined);
	assert.equal(parseWikiChanges(JSON.stringify({ changes: [{ action: "update", targetId: "missing", title: "Bad", rule: "No.", why: "No.", exceptions: "None.", sources: ["session-a/entry-1"] }] }), evidence, pages), undefined);
	wiki.updatePattern(secondId, change.draft);
	assert.match(wiki.patternPages().find((page) => page.id === secondId)?.content ?? "", /New rule/);
	wiki.deletePattern(secondId, change.draft.sources);
	assert.equal(wiki.patternPages().length, 1);
	assert.match(readFileSync(wiki.evolutionPath, "utf8"), /Deleted the pattern page/);
});

test("records final approval claims and decisions without session suggestions", () => {
	const store = new KnowledgeStore(root, "example-project");
	const [claim] = store.recordApprovalClaims([{ action: "delete", targetId: "page-1", sources: [{ sessionId: "session-a", entryIds: ["entry-1"] }] }]);
	assert.ok(claim);
	store.recordApprovalDecision(claim.id, "rejected");
	assert.deepEqual(store.approvalClaims().map((entry) => "status" in entry ? entry.status : entry.change.action), ["delete", "rejected"]);
});

function writeSessionFile(sessionFile: string, sessionId: string, entries: Record<string, unknown>[], cwd = root): void {
	mkdirSync(join(sessionFile, ".."), { recursive: true });
	writeFileSync(
		sessionFile,
		[
			JSON.stringify({ type: "session", version: 3, id: sessionId, timestamp: "2026-01-01T00:00:00.000Z", cwd }),
			...entries.map((entry) => JSON.stringify(entry)),
		].join("\n") + "\n",
	);
}
