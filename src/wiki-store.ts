import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface PatternSource {
	sessionId: string;
	entryIds: string[];
}

export interface PatternDraft {
	title: string;
	rule: string;
	why: string;
	exceptions: string;
	sources: PatternSource[];
}

export class WikiStore {
	readonly patternsDir: string;
	readonly evolutionPath: string;

	constructor(projectDir: string) {
		const wikiDir = join(projectDir, "wiki");
		this.patternsDir = join(wikiDir, "patterns");
		this.evolutionPath = join(wikiDir, "evolution.md");
	}

	patterns(): string[] {
		if (!existsSync(this.patternsDir)) return [];
		return readdirSync(this.patternsDir)
			.filter((name) => name.endsWith(".md"))
			.sort()
			.map((name) => readFileSync(join(this.patternsDir, name), "utf8"));
	}

	createPattern(draft: PatternDraft): string {
		mkdirSync(this.patternsDir, { recursive: true });
		const id = randomUUID();
		writeFileSync(join(this.patternsDir, `${id}.md`), formatPattern(draft), "utf8");
		if (!existsSync(this.evolutionPath)) writeFileSync(this.evolutionPath, "# Wiki Evolution Log\n", "utf8");
		appendFileSync(this.evolutionPath, formatEvolutionEntry(id, draft.sources), "utf8");
		return id;
	}
}

export function formatPattern(draft: PatternDraft): string {
	return `---
title: ${JSON.stringify(draft.title)}
sources: ${JSON.stringify(draft.sources)}
---

## Rule

${draft.rule}

## Why

${draft.why}

## Exceptions

${draft.exceptions}
`;
}

function formatEvolutionEntry(id: string, sources: PatternSource[]): string {
	const references = sources.flatMap((source) => source.entryIds.map((entryId) => `${source.sessionId}/${entryId}`));
	return `\n## ${new Date().toISOString()}\n\n- Pattern: \`${id}\`\n- Sources: ${references.map((reference) => `\`${reference}\``).join(", ")}\n- Change: Created the pattern page.\n`;
}
