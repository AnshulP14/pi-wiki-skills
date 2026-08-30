import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { KnowledgeStore } from "./knowledge-store.ts";

const storageRoot = join(getAgentDir(), "pi-wiki-skills");

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", (_event, ctx) => {
		const store = new KnowledgeStore(storageRoot, ctx.cwd);
		store.captureEntries(ctx.sessionManager.getSessionId(), ctx.sessionManager.getBranch());
	});

	pi.registerCommand("wiki-status", {
		description: "Show the current project knowledge state",
		handler: async (_args, ctx) => {
			const store = new KnowledgeStore(storageRoot, ctx.cwd);
			const claims = store.currentClaims();
			const entries = store.capturedEntryCount();
			ctx.ui.notify(
				`Wiki Skills: ${claims.length} current claim${claims.length === 1 ? "" : "s"}; ${entries} captured entr${entries === 1 ? "y" : "ies"}.`,
				"info",
			);
		},
	});
}
