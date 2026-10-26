import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lintProject, parseProjectJsonc } from '@gt6tg/core';

const projectPath = resolve(import.meta.dirname, '../../project.jsonc');
const parsed = parseProjectJsonc(readFileSync(projectPath, 'utf8'));
const lint = parsed.config ? lintProject(parsed.config) : undefined;
const issues = [...parsed.issues, ...(lint?.issues ?? [])];
const errors = issues.filter((issue) => issue.severity === 'error');

console.log(
  JSON.stringify(
    {
      path: projectPath,
      parsed: parsed.config !== null,
      stats: lint?.stats,
      issues,
      ok: errors.length === 0,
    },
    null,
    2,
  ),
);

if (errors.length) {
  process.exitCode = 1;
}
