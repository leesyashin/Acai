// Entry point for `node --test tests/` (DESIGN.md §4.10). Node 22 resolves a directory
// argument as a module, so this file loads every unit test file in this folder.
// `npm test` uses the glob "tests/**/*.test.mjs" and does not need this file.

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
for (const f of files) await import(pathToFileURL(path.join(dir, f)).href);
