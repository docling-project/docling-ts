import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'DoclingComponents',
      fileName: format => `index.${format}.js`,
    },
    rollupOptions: {
      // external: ['lit', '@docling/core'],
      // output: {
      //   // Provide global variables to use in the UMD build
      //   // for externalized deps
      //   globals: {
      //     lit: 'lit',
      //     '@docling/core': 'docling',
      //   },
      // },
    },
  },
});
