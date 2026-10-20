import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOfflineServer } from './offline-server.js';

const position = process.argv.indexOf('--port');
const port = position === -1 ? 5174 : Number(process.argv[position + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local port.');
const server = await createOfflineServer(dirname(fileURLToPath(import.meta.url)));
server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? 'Port ' + port + ' is occupied. Close the existing SiteFoundry server or use --port.' : error.message);
    process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log('SiteFoundry: http://127.0.0.1:' + port + '/ (local/offline)'));
