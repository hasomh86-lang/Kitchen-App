// Assembles release/ (prebuilt web app + bundled server + migrations + deploy scripts)
// for the oracle-release branch that the server installs from.
import { cpSync, rmSync, writeFileSync } from 'node:fs';
for (const d of ['dist', 'migrations', 'deploy']) { rmSync(`release/${d}`, { recursive: true, force: true }); cpSync(d, `release/${d}`, { recursive: true }); }
writeFileSync('release/README.md', `# Artisan Kitchen — server release\n\nPrebuilt files for the self-hosted server (Oracle Cloud, Riyadh).\nSource code lives on the \`v2\` branch. Install: see deploy/install.sh.\n`);
console.log('release/ ready');
