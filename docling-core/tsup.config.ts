import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'doclang/index': 'src/doclang/index.ts',
  },
  clean: true,
  format: ['cjs', 'esm'],
  dts: true,
});
