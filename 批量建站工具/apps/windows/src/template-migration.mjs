/** Read-only import from the standalone browser server's legacy template store.
 * A validated, freshly normalized store is installed only before the native app
 * has its own manifest; the original browser store is never modified. */
import { access, mkdir, readFile, readdir, realpath, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

const builtInVersions = new Set(['initial', 'v1.0.0', 'v1.0.1', 'v1.0.2', 'v1.0.2.1']);
async function exists(path) { try { await access(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }

export async function migrateLegacyTemplates({ legacyStore, dataDirectory, validateTemplate }) {
  const destination = join(dataDirectory, 'ad-templates');
  if (await exists(join(destination, 'manifest.json'))) return { state: 'native-store-exists' };
  if (!await exists(join(legacyStore, 'manifest.json'))) return { state: 'no-legacy-store' };
  if (await exists(destination) && (await readdir(destination)).length) return { state: 'native-files-exist', message: '应用模板目录已有文件，未覆盖。浏览器版模板可手动重新导入。' };
  const stage = join(dataDirectory, 'ad-templates-import-' + randomUUID());
  try {
    const sourceRoot = await realpath(legacyStore);
    const manifest = JSON.parse(await readFile(join(sourceRoot, 'manifest.json'), 'utf8'));
    if (manifest.schema !== 'sitefoundry-ad-templates/v1' || !Array.isArray(manifest.templates) || manifest.templates.length > 10000) throw new Error('旧模板清单格式无效。');
    const templates = [], versions = new Set();
    for (const entry of manifest.templates) {
      if (!entry || typeof entry.version !== 'string' || !/^custom\/[A-Za-z0-9.-]+\.json$/.test(entry.file || '') || versions.has(entry.version)) throw new Error('旧模板清单包含无效或重复条目。');
      const file = await realpath(join(sourceRoot, entry.file));
      if (!file.startsWith(sourceRoot + sep)) throw new Error('旧模板文件超出模板目录。');
      const input = JSON.parse(await readFile(file, 'utf8'));
      if (input.version !== entry.version) throw new Error('旧模板版本不一致。');
      // Recompute every replaceable source range with the shared AST validator.
      // Stored JavaScript remains data, including during the migration.
      const template = validateTemplate(input);
      versions.add(template.version); templates.push(template);
    }
    if (!builtInVersions.has(manifest.defaultVersion) && !versions.has(manifest.defaultVersion)) throw new Error('旧模板默认版本不存在。');
    await mkdir(join(stage, 'custom'), { recursive: true });
    for (const template of templates) await writeFile(join(stage, template.file), JSON.stringify(template, null, 2) + '\n');
    await writeFile(join(stage, 'manifest.json'), JSON.stringify({ schema: manifest.schema, defaultVersion: manifest.defaultVersion, templates: templates.map(({ version, file }) => ({ version, file })) }, null, 2) + '\n');
    if (await exists(destination)) await rmdir(destination); // Empty only; never recursive.
    await rename(stage, destination);
    return { state: 'migrated', count: templates.length, defaultVersion: manifest.defaultVersion };
  } catch (error) {
    await rm(stage, { recursive: true, force: true }); // This function's fresh UUID child only.
    return { state: 'legacy-invalid', message: '浏览器版广告模板未自动导入：' + error.message + ' 原文件仍保留，可重新选择模板导入。' };
  }
}
