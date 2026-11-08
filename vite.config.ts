import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'
import { rmSync } from 'node:fs'

export default defineConfig({
  plugins: [
    { name: 'refresh-pages-static-routes', buildStart() { rmSync(new URL('./dist/_routes.json', import.meta.url), { force: true }) } },
    build(),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ]
})
