import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type PackageManifest = {
  scripts?: Record<string, string>;
};

type TypeScriptConfig = {
  compilerOptions?: {
    lib?: string[];
    strict?: boolean;
  };
};

const projectRoot = resolve(import.meta.dirname, '../..');

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(resolve(projectRoot, fileName), 'utf8')) as T;
}

describe('project configuration', () => {
  it('enforces strict browser TypeScript and exposes the development workflow', () => {
    const packageManifest = readJson<PackageManifest>('package.json');
    const typeScriptConfig = readJson<TypeScriptConfig>('tsconfig.json');

    expect(typeScriptConfig.compilerOptions?.strict).toBe(true);
    expect(typeScriptConfig.compilerOptions?.lib).toEqual(['ES2022', 'DOM', 'DOM.Iterable']);
    expect(packageManifest.scripts).toMatchObject({
      dev: expect.any(String),
      build: expect.any(String),
      preview: expect.any(String),
      typecheck: expect.any(String),
      test: expect.any(String),
      'test:watch': expect.any(String),
      'test:e2e': expect.any(String),
      lint: expect.any(String),
      format: expect.any(String),
      'format:check': expect.any(String),
      check: expect.any(String),
      tauri: expect.any(String)
    });
  });

  it('runs end-to-end checks without collecting Vitest smoke tests', () => {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npmCommand, ['run', 'test:e2e'], {
      cwd: projectRoot,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
  });

  it('checks project sources with the configured formatter', () => {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npmCommand, ['run', 'format:check'], {
      cwd: projectRoot,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
  });
});
