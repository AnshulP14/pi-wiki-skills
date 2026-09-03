import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
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

export interface PatternPage {
	id: string;
	title: string;
	content: string;
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
		return this.patternPages().map((page) => page.content);
	}

	patternPages(): PatternPage[] {
		if (!existsSync(this.patternsDir)) return [];
		return readdirSync(this.patternsDir)
			.filter((name) => name.endsWith(".md"))
			.sort()
			.map((name) => {
				const id = name.slice(0, -".md".length);
				const content = readFileSync(join(this.patternsDir, name), "utf8");
				return { id, title: patternTitle(content) ?? id, content };
			});
	}

	createPattern(draft: PatternDraft): string {
		mkdirSync(this.patternsDir, { recursive: true });
		const id = randomUUID();
		this.writePattern(id, draft, "Created");
		return id;
	}

	updatePattern(id: string, draft: PatternDraft): void {
		if (!existsSync(join(this.patternsDir, `${id}.md`))) throw new Error(`Unknown wiki pattern: ${id}`);
		this.writePattern(id, draft, "Updated");
	}

	deletePattern(id: string, sources: PatternSource[]): void {
		const path = join(this.patternsDir, `${id}.md`);
		if (!existsSync(path)) throw new Error(`Unknown wiki pattern: ${id}`);
		unlinkSync(path);
		if (!existsSync(this.evolutionPath)) writeFileSync(this.evolutionPath, "# Wiki Evolution Log\n", "utf8");
		appendFileSync(this.evolutionPath, formatEvolutionEntry(id, sources, "Deleted"), "utf8");
	}

	private writePattern(id: string, draft: PatternDraft, change: string): void {
		mkdirSync(this.patternsDir, { recursive: true });
		writeFileSync(join(this.patternsDir, `${id}.md`), formatPattern(draft), "utf8");
		if (!existsSync(this.evolutionPath)) writeFileSync(this.evolutionPath, "# Wiki Evolution Log\n", "utf8");
		appendFileSync(this.evolutionPath, formatEvolutionEntry(id, draft.sources, change), "utf8");
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

function patternTitle(content: string): string | undefined {
	const value = /^title:\s*(.+)$/m.exec(content)?.[1];
	if (!value) return undefined;
	try {
		const title: unknown = JSON.parse(value);
		return typeof title === "string" ? title : undefined;
	} catch {
		return undefined;
	}
}

function formatEvolutionEntry(id: string, sources: PatternSource[], change: string): string {
	const references = sources.flatMap((source) => source.entryIds.map((entryId) => `${source.sessionId}/${entryId}`));
	return `\n## ${new Date().toISOString()}\n\n- Pattern: \`${id}\`\n- Sources: ${references.map((reference) => `\`${reference}\``).join(", ")}\n- Change: ${change} the pattern page.\n`;
}
