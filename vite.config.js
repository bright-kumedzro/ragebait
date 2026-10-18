import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Writes a hash of the build output into dist/sw.js, so each deploy gets its own offline cache.
function stampServiceWorker() {
  let outDir, id;
  return {
    name: 'stamp-sw',
    apply: 'build',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir); },
    generateBundle(_, bundle) {
      const h = createHash('sha1');
      for (const k of Object.keys(bundle).sort()) h.update(k).update(bundle[k].code ?? bundle[k].source);
      id = h.digest('hex').slice(0, 10);
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js'), src = readFileSync(file, 'utf8');
      if (!src.includes("'ragebait-__BUILD__'")) throw new Error('sw.js: cache name placeholder not found');
      writeFileSync(file, src.replace("'ragebait-__BUILD__'", `'ragebait-${id}'`));
    },
  };
}

// `npm run dev` serves /about and /privacy the way Vercel's cleanUrls does.
const cleanUrls = () => ({
  name: 'clean-urls',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (/^\/(about|privacy)(\?|$)/.test(req.url)) req.url = req.url.replace(/^\/(about|privacy)/, '/$1.html');
      next();
    });
  },
});

export default {
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: { input: { main: 'index.html', about: 'about.html', privacy: 'privacy.html', notFound: '404.html' } },
  },
  plugins: [stampServiceWorker(), cleanUrls()],
};
