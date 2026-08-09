import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

mkdirSync('api', { recursive: true });

// Remove leftover route folders from older deploys so Vercel only sees index.js.
for (const dir of ['auth', 'habits', 'recommendations']) {
  rmSync(`api/${dir}`, { recursive: true, force: true });
}
rmSync('api/[...path].js', { force: true });
rmSync('api/health.js', { force: true });

await build({
  entryPoints: ['src/vercelEntry.ts'],
  outfile: 'api/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'info',
});

// Tiny helper so a missing build is obvious in Runtime Logs.
writeFileSync(
  'api/index.js',
  `${(await import('node:fs')).readFileSync('api/index.js', 'utf8')}\n`,
);

console.log('Built api/index.js');
