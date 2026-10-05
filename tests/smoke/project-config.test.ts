import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(resolve(repositoryRoot, path), 'utf8')) as Record<
    string,
    unknown
  >;
}

describe('project configuration', () => {
  it('keeps the runnable shell strict and exposes its required commands', async () => {
    const [packageJson, tsconfig] = await Promise.all([
      readJson('package.json'),
      readJson('tsconfig.json'),
    ]);
    const scripts = packageJson.scripts as Record<string, string>;
    const compilerOptions = tsconfig.compilerOptions as Record<string, unknown>;

    expect(compilerOptions.strict).toBe(true);
    expect(compilerOptions.lib).toEqual(['ES2022', 'DOM', 'DOM.Iterable']);
    expect(Object.keys(scripts)).toEqual(
      expect.arrayContaining([
        'dev',
        'build',
        'preview',
        'typecheck',
        'test',
        'test:watch',
        'test:e2e',
        'lint',
        'format',
        'format:check',
        'check',
        'tauri',
      ]),
    );
  });
});
