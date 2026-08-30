import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { KnowledgeStore } from "./knowledge-store.ts";
import { resolveSourceAnchor } from "./source-resolver.ts";

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
