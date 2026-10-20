import readline from 'node:readline';
import { createBuildManager } from './index.mjs';

// One long-lived private Node process provides persistent tasks to Kotlin. Build
// output stays in task logs; stdout is exclusively this JSON transport protocol.
const manager = createBuildManager({ dataDirectory: process.env.SITEFOUNDRY_DATA_DIR, npmCli: process.env.SITEFOUNDRY_NPM_CLI });
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', async (line) => {
  let request;
  try {
    request = JSON.parse(line);
    if (!Object.hasOwn(manager, request.method)) throw Object.assign(new Error('Unknown runtime method'), { code: 'METHOD_NOT_FOUND' });
    const result = await manager[request.method](request.params || {});
    process.stdout.write(JSON.stringify({ id: request.id, result }) + '\n');
  } catch (error) { process.stdout.write(JSON.stringify({ id: request?.id, error: { code: error.code || 'RUNTIME_ERROR', message: error.message } }) + '\n'); }
});
input.on('close', async () => { await manager.dispose(); });
