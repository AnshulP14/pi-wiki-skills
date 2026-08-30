import type { UserMessage } from "@earendil-works/pi-ai";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { buildDreamPrompt, parseDreamProposal, selectDreamEvidence } from "./dream.ts";
import { KnowledgeStore } from "./knowledge-store.ts";
import { resolveSourceAnchor } from "./source-resolver.ts";
import { formatPattern, WikiStore } from "./wiki-store.ts";

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
		description: "Show the current project knowledge state",
		handler: async (_args, ctx) => {
			const store = new KnowledgeStore(storageRoot, ctx.cwd);
			const anchors = store.sourceAnchorCount();
			ctx.ui.notify(`Wiki Skills: ${anchors} source anchor${anchors === 1 ? "" : "s"}.`, "info");
		},
	});

	pi.registerCommand("wiki-dream", {
		description: "Propose one reviewed wiki pattern from verified project traces",
		handler: async (_args, ctx) => {
			if (!ctx.model) {
				ctx.ui.notify("Wiki Skills: select a model before dreaming.", "error");
				return;
			}
			if (!ctx.hasUI) {
				ctx.ui.notify("Wiki Skills: dreaming requires an approval-capable UI.", "error");
				return;
			}

			const store = new KnowledgeStore(storageRoot, ctx.cwd);
			const evidence = selectDreamEvidence(store.sourceAnchors().map(resolveSourceAnchor));
			if (evidence.length === 0) {
				ctx.ui.notify("Wiki Skills: no verified source anchors to dream from.", "warning");
				return;
			}

			const wiki = new WikiStore(store.projectDir);
			const request: UserMessage = {
				role: "user",
				content: [{ type: "text", text: buildDreamPrompt(evidence, wiki.patterns()) }],
				timestamp: Date.now(),
			};
			let response;
			try {
				response = await ctx.modelRegistry.complete(ctx.model, { systemPrompt: "You maintain concise project wiki pages.", messages: [request] });
			} catch (error) {
				ctx.ui.notify(`Wiki Skills: dream failed: ${error instanceof Error ? error.message : String(error)}`, "error");
				return;
			}
			const text = response.content
				.filter((part): part is { type: "text"; text: string } => part.type === "text")
				.map((part) => part.text)
				.join("\n");
			const proposal = parseDreamProposal(text, evidence);
			if (!proposal) {
				ctx.ui.notify("Wiki Skills: no valid pattern was proposed.", "info");
				return;
			}
			if (!(await ctx.ui.confirm("Create wiki pattern?", formatPattern(proposal)))) {
				ctx.ui.notify("Wiki Skills: proposal rejected.", "info");
				return;
			}
			const id = wiki.createPattern(proposal);
			ctx.ui.notify(`Wiki Skills: created pattern ${id}.`, "info");
		},
	});

	pi.registerCommand("wiki-verify", {
		description: "Verify source anchors against Pi session files",
		handler: async (_args, ctx) => {
			const store = new KnowledgeStore(storageRoot, ctx.cwd);
			const resolutions = store.sourceAnchors().map(resolveSourceAnchor);
			const verified = resolutions.filter((resolution) => resolution.status === "verified").length;
			ctx.ui.notify(
				`Wiki Skills: ${verified}/${resolutions.length} source anchors verified.`,
				verified === resolutions.length ? "info" : "warning",
			);
		},
	});
}
