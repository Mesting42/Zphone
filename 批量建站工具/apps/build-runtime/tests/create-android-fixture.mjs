import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArtifactZip } from '../zip.mjs';

// Build a small raw Next project from the already approved exact package/lock
// fixture. It intentionally still uses next/font/google when imported. Every
// file written by this developer helper lives in a new acceptance directory.
const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dependencyFixture = process.argv[2] || path.join(application, 'coverage/offline-fixes-20261013/offline/finished-source-build');
const output = process.argv[3] || path.join(application, 'coverage/apps-20261013/android-next-fixture');
const source = path.join(output, 'source');
await fs.mkdir(path.join(source, 'app'), { recursive: true });
await fs.mkdir(path.join(source, 'public'), { recursive: true });
for (const file of ['package.json', 'package-lock.json']) await fs.copyFile(path.join(dependencyFixture, file), path.join(source, file));
await fs.writeFile(path.join(source, 'next.config.mjs'), `export default { output: 'export', trailingSlash: true, images: { unoptimized: true }, experimental: { cpus: 1 } };\n`);
await fs.writeFile(path.join(source, 'app/layout.jsx'), `import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], weight: ['400', '700'] });
export const metadata = { title: 'SiteFoundry Android Offline Next' };
export default function Layout({ children }) { return <html lang="en"><body className={inter.className}>{children}</body></html>; }
`);
await fs.writeFile(path.join(source, 'app/page.jsx'), `export default function Page() { return <main><h1>PixelWire Android offline acceptance</h1><p>Compiled on this Android device with local fonts.</p><img src="/local-check.svg" alt="Local resource" /></main>; }\n`);
await fs.writeFile(path.join(source, 'public/local-check.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#17736e"/></svg>');
const archivePath = path.join(output, 'sitefoundry-raw-next-android.zip');
const artifact = await createArtifactZip(source, archivePath);
await fs.writeFile(path.join(output, 'fixture.json'), JSON.stringify({ schema: 1, archivePath, ...artifact, nextFontImport: 'next/font/google', sourceOfDependencies: dependencyFixture, scope: 'Small raw Next15.5.4 fixture; not full PixelWire content acceptance' }, null, 2));
console.log(JSON.stringify({ archivePath, ...artifact }));
