import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  clean: true,
  format: ['cjs', 'esm'],
  dts: true,
  target: 'es2022',
  tsconfig: 'tsconfig.json',
  // Bundle all dependencies so the ESM output works directly in the browser
  // without an import map or bundler (lit, @lit/task, @docling/docling-core).
  noExternal: [/.*/],
});
