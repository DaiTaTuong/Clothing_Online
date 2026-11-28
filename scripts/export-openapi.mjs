import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMergedOpenApi } from '../backend/src/routes/identity.routes.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const merged = await buildMergedOpenApi(root);
const outPath = resolve(root, 'docs', 'api', 'openapi.json');
await writeFile(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
console.log(`Exported OpenAPI (${Object.keys(merged.paths).length} paths) -> ${outPath}`);
