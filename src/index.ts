import type { UserMessage } from "@earendil-works/pi-ai";
import {
	DynamicBorder,
	getAgentDir,
	getMarkdownTheme,
	type ExtensionAPI,
	type ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, SelectList, Text, type SelectItem } from "@earendil-works/pi-tui";
import { join } from "node:path";
import {
	buildConsolidationPrompt,
	buildSessionStepPrompt,
	buildWikiCatalog,
	parseSessionStep,
	parseWikiChanges,
	selectDreamSessions,
	type DreamEvidence,
	type SessionSuggestion,
	type WikiChange,
} from "./dream.ts";
import { KnowledgeStore, sourceAnchorKey } from "./knowledge-store.ts";
import { resolveSourceAnchor, type SourceResolution } from "./source-resolver.ts";
import { formatPattern, type PatternPage, WikiStore } from "./wiki-store.ts";

const storageRoot = join(getAgentDir(), "pi-wiki-skills");

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", (_event, ctx) => {
		const store = new KnowledgeStore(storageRoot, ctx.cwd);
		store.captureAnchors(
			ctx.sessionManager.getSessionFile(),
			ctx.sessionManager.getSessionId(),
			ctx.sessionManager.getBranch(),
		);
	});

	pi.registerCommand("wiki-status", {
		description: "Show verified evidence and wiki knowledge for this project",
		handler: async (_args, ctx) => {
			const store = new KnowledgeStore(storageRoot, ctx.cwd);
			store.captureProjectAnchors(join(getAgentDir(), "sessions"));
			const anchors = store.sourceAnchors();
			const resolutions = anchors.map(resolveSourceAnchor);
			const wiki = new WikiStore(store.projectDir);
			const dashboard = formatDashboard(store, resolutions, wiki);
			if (ctx.mode !== "tui") {
				ctx.ui.notify(dashboard.replaceAll("\n", " · "), "info");
				return;
			}
			if ((await showDashboard(ctx, dashboard)) === "browse") await browseWiki(ctx, store, resolutions);
		},
	});

	pi.registerCommand("wiki-browse", {
		description: "Browse verified source anchors and wiki patterns",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("Wiki Skills: browsing requires the interactive TUI.", "error");
				return;
			}
			const store = new KnowledgeStore(storageRoot, ctx.cwd);
			store.captureProjectAnchors(join(getAgentDir(), "sessions"));
			await browseWiki(ctx, store, store.sourceAnchors().map(resolveSourceAnchor));
		},
	});

	pi.registerCommand("wiki-dream", {
		description: "Propose reviewed wiki changes from project sessions; use --all to re-review history",
		handler: async (args, ctx) => {
			const allHistory = args.trim() === "--all";
			if (args.trim() && !allHistory) {
				ctx.ui.notify("Wiki Skills: usage: /wiki-dream [--all]", "error");
				return;
			}
			if (!ctx.model) {
				ctx.ui.notify("Wiki Skills: select a model before dreaming.", "error");
				return;
			}
			if (!ctx.hasUI) {
				ctx.ui.notify("Wiki Skills: dreaming requires an approval-capable UI.", "error");
				return;
			}

			const store = new KnowledgeStore(storageRoot, ctx.cwd);
			store.captureProjectAnchors(join(getAgentDir(), "sessions"));
			const resolutions = store.sourceAnchors().map(resolveSourceAnchor);
			const reviewedAnchorKeys = allHistory ? new Set<string>() : store.reviewedAnchorKeys();
			const sessions = selectDreamSessions(resolutions, reviewedAnchorKeys).filter((session) => session.evidence.length > 0);
			const newAnchors = sessions.flatMap((session) => session.evidence.flatMap((item) => item.anchors));
			if (sessions.length === 0) {
				ctx.ui.notify("Wiki Skills: no new verified project entries to dream from.", "warning");
				return;
			}

			const wiki = new WikiStore(store.projectDir);
			const pages = wiki.patternPages();
			const catalog = buildWikiCatalog(pages);
			const suggestions: SessionSuggestion[] = [];
			try {
				for (const session of sessions) {
					let page: PatternPage | undefined;
					const visitedPageIds = new Set<string>();
					const changes: WikiChange[] = [];
					while (true) {
						const step = parseSessionStep(
							await completeDream(ctx, buildSessionStepPrompt(session, catalog, page, [...visitedPageIds], changes)),
							session.evidence,
							page,
							pages,
							visitedPageIds,
						);
						if (!step) throw new Error(`invalid wiki step for session ${session.sessionId}`);
						changes.push(...step.changes);
						if (!step.nextPage) break;
						page = step.nextPage;
						visitedPageIds.add(page.id);
					}
					suggestions.push({ sessionId: session.sessionId, changes });
				}
				const evidence: DreamEvidence[] = sessions.flatMap((session) => session.evidence);
				const selectedPageIds = new Set(
					suggestions.flatMap((suggestion) => suggestion.changes.flatMap((change) => (change.action === "create" ? [] : [change.targetId]))),
				);
				const changes = parseWikiChanges(await completeDream(ctx, buildConsolidationPrompt(suggestions)), evidence, pages.filter((page) => selectedPageIds.has(page.id)));
				if (!changes) throw new Error("invalid consolidated wiki changes");
				if (changes.length === 0) {
					store.recordDreamRun("no-pattern", newAnchors);
					ctx.ui.notify("Wiki Skills: no useful wiki changes were proposed.", "info");
					return;
				}
				const claims = store.recordApprovalClaims(changes);
				let approved = 0;
				for (const claim of claims) {
					const accepted = await ctx.ui.confirm(`Apply wiki ${claim.change.action}?`, formatChange(claim.change));
					if (accepted) {
						if (claim.change.action === "create") wiki.createPattern(claim.change.draft);
						else if (claim.change.action === "update") wiki.updatePattern(claim.change.targetId, claim.change.draft);
						else wiki.deletePattern(claim.change.targetId, claim.change.sources);
						approved += 1;
					}
					store.recordApprovalDecision(claim.id, accepted ? "approved" : "rejected");
				}
				store.recordDreamRun(approved ? "approved" : "rejected", newAnchors);
				ctx.ui.notify(`Wiki Skills: applied ${approved} of ${changes.length} proposed change${changes.length === 1 ? "" : "s"}.`, "info");
			} catch (error) {
				ctx.ui.notify(`Wiki Skills: dream failed: ${error instanceof Error ? error.message : String(error)}`, "error");
			}
		},
	});
}

function formatDashboard(store: KnowledgeStore, resolutions: SourceResolution[], wiki: WikiStore): string {
	const verified = resolutions.filter((resolution) => resolution.status === "verified").length;
	const issues = resolutions.filter((resolution) => resolution.status !== "verified");
	const sessions = new Set(resolutions.map((resolution) => resolution.anchor.sessionId)).size;
	const pending = resolutions.filter(
		(resolution) => resolution.status === "verified" && !store.reviewedAnchorKeys().has(sourceAnchorKey(resolution.anchor)),
	).length;
	const issueSummary = [...new Set(issues.map((resolution) => resolution.status))].join(", ");
	return [
		"# Wiki Skills",
		"",
		`**Evidence:** ${resolutions.length} anchors · ${verified} verified${issues.length ? ` · ${issues.length} issue${issues.length === 1 ? "" : "s"}` : ""}`,
		`**Sessions:** ${sessions} source session${sessions === 1 ? "" : "s"}`,
		`**Knowledge:** ${wiki.patternPages().length} pattern${wiki.patternPages().length === 1 ? "" : "s"}`,
		`**Dream:** ${pending} unreviewed verified entr${pending === 1 ? "y" : "ies"}`,
		`**Storage:** \`${store.projectDir}\``,
		...(issueSummary ? [`**Issues:** ${issueSummary}`] : []),
	].join("\n");
}

async function showDashboard(ctx: ExtensionCommandContext, dashboard: string): Promise<"browse" | undefined> {
	return ctx.ui.custom<"browse" | undefined>((tui, theme, _keybindings, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
		container.addChild(new Markdown(dashboard, 1, 1, getMarkdownTheme()));
		const actions = new SelectList(
			[
				{ value: "browse", label: "Browse knowledge", description: "Patterns and source anchors" },
				{ value: "close", label: "Close" },
			],
			2,
			selectTheme(theme),
		);
		actions.onSelect = (item) => done(item.value === "browse" ? "browse" : undefined);
		actions.onCancel = () => done(undefined);
		container.addChild(actions);
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
		return {
			render: (width) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data) => {
				actions.handleInput(data);
				tui.requestRender();
			},
		};
	});
}

async function browseWiki(ctx: ExtensionCommandContext, store: KnowledgeStore, resolutions: SourceResolution[]): Promise<void> {
	const wiki = new WikiStore(store.projectDir);
	while (true) {
		const choice = await selectEntry(ctx, "Wiki browser", [
			{ value: "patterns", label: `Patterns (${wiki.patternPages().length})` },
			{ value: "anchors", label: `Source anchors (${resolutions.length})` },
			{ value: "close", label: "Close" },
		]);
		if (!choice || choice === "close") return;
		if (choice === "patterns") await browsePatterns(ctx, wiki);
		else await browseAnchors(ctx, resolutions);
	}
}

async function browsePatterns(ctx: ExtensionCommandContext, wiki: WikiStore): Promise<void> {
	const pages = wiki.patternPages();
	if (pages.length === 0) {
		ctx.ui.notify("Wiki Skills: no pattern pages yet.", "info");
		return;
	}
	while (true) {
		const choice = await selectEntry(ctx, "Wiki patterns", [
			...pages.map((page) => ({ value: page.id, label: page.title, description: page.id })),
			{ value: "back", label: "Back" },
		]);
		if (!choice || choice === "back") return;
		const page = pages.find((candidate) => candidate.id === choice);
		if (page) await showViewer(ctx, `Pattern: ${page.title}`, page.content);
	}
}

async function browseAnchors(ctx: ExtensionCommandContext, resolutions: SourceResolution[]): Promise<void> {
	if (resolutions.length === 0) {
		ctx.ui.notify("Wiki Skills: no source anchors yet.", "info");
		return;
	}
	while (true) {
		const choice = await selectEntry(ctx, "Source anchors", [
			...resolutions.map((resolution, index) => ({
				value: String(index),
				label: `${resolution.anchor.sessionId.slice(0, 8)}/${resolution.anchor.entryId.slice(0, 8)}`,
				description: resolution.status,
			})),
			{ value: "back", label: "Back" },
		]);
		if (!choice || choice === "back") return;
		const resolution = resolutions[Number(choice)];
		if (resolution) await showViewer(ctx, "Source anchor", formatAnchor(resolution));
	}
}

async function selectEntry(ctx: ExtensionCommandContext, title: string, items: SelectItem[]): Promise<string | undefined> {
	return ctx.ui.custom<string | undefined>((tui, theme, _keybindings, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
		container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
		const list = new SelectList(items, Math.min(items.length, 10), selectTheme(theme));
		list.onSelect = (item) => done(item.value);
		list.onCancel = () => done(undefined);
		container.addChild(list);
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
		return {
			render: (width) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data) => {
				list.handleInput(data);
				tui.requestRender();
			},
		};
	});
}

async function showViewer(ctx: ExtensionCommandContext, title: string, content: string): Promise<void> {
	await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
		container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
		container.addChild(new Markdown(content, 1, 1, getMarkdownTheme()));
		const close = new SelectList([{ value: "close", label: "Back" }], 1, selectTheme(theme));
		close.onSelect = () => done(undefined);
		close.onCancel = () => done(undefined);
		container.addChild(close);
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
		return {
			render: (width) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data) => {
				close.handleInput(data);
				tui.requestRender();
			},
		};
	});
}

function selectTheme(theme: ExtensionCommandContext["ui"]["theme"]): ConstructorParameters<typeof SelectList>[2] {
	return {
		selectedPrefix: (text) => theme.fg("accent", text),
		selectedText: (text) => theme.fg("accent", text),
		description: (text) => theme.fg("muted", text),
		scrollInfo: (text) => theme.fg("dim", text),
		noMatch: (text) => theme.fg("warning", text),
	};
}

async function completeDream(ctx: ExtensionCommandContext, text: string): Promise<string> {
	if (!ctx.model) throw new Error("No model selected.");
	const request: UserMessage = {
		role: "user",
		content: [{ type: "text", text }],
		timestamp: Date.now(),
	};
	const response = await ctx.modelRegistry.complete(ctx.model, {
		systemPrompt: "You maintain concise, evidence-backed project wiki pages.",
		messages: [request],
	});
	return response.content
		.filter((part): part is { type: "text"; text: string } => part.type === "text")
		.map((part) => part.text)
		.join("\n");
}

function formatChange(change: WikiChange): string {
	if (change.action === "delete") return `Target: \`${change.targetId}\`\n\nThis permanently deletes the wiki page.`;
	return `${change.action === "update" ? `Target: \`${change.targetId}\`\n\n` : ""}${formatPattern(change.draft)}`;
}

function formatAnchor(resolution: SourceResolution): string {
	const { anchor } = resolution;
	return [
		`**Status:** ${resolution.status}`,
		`**Session:** \`${anchor.sessionId}\``,
		`**Entry:** \`${anchor.entryId}\``,
		`**Source file:** \`${anchor.sessionFile}\``,
		`**SHA-256:** \`${anchor.contentHash}\``,
	].join("\n\n");
}
