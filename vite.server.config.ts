import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    ssr: 'api/index.ts',
    outDir: 'api',
    emptyOutDir: false,
    minify: false,
    target: 'node20',
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'index.mjs',
        inlineDynamicImports: true,
      },
    },
  },
})
