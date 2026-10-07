import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

export default defineConfig({
  server: { host: '127.0.0.1', hmr: process.env.RIVENBLOOM_TEST === '1' ? false : undefined },
  plugins: [
    {
      name: 'rivenbloom-offline-build',
      apply: 'build',
      async closeBundle() {
        const root = 'dist';
        const entries = await readdir(root, { recursive: true, withFileTypes: true });
        const paths = entries
          .filter((entry) => entry.isFile() && entry.name !== 'sw.js')
          .map((entry) => join(entry.parentPath, entry.name))
          .sort();
        const hash = createHash('sha256');
        for (const path of paths) {
          hash.update(relative(root, path));
          hash.update(await readFile(path));
        }
        const urls = [
          '/',
          ...paths.map((path) => '/' + relative(root, path).replaceAll('\\', '/')),
        ];
        const template = await readFile('public/sw.js', 'utf8');
        await writeFile(
          join(root, 'sw.js'),
          template
            .replace(
              "const BUILD_ID = 'development';",
              `const BUILD_ID = '${hash.digest('hex').slice(0, 16)}';`,
            )
            .replace(/const SHELL = .*?;/, `const SHELL = ${JSON.stringify(urls)};`),
        );
      },
    },
  ],
});
