'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { promisify } = require('node:util');

// npm's script-shell handles the outer build command. Packages such as cross-env
// also spawn Node-based bins directly; Android 10+ refuses execve of those files
// in private app data. Resolve their readable shebang script to the installed
// native Node executable, preserving arguments/cwd/env and process semantics.
function adaptNodeCommand(command, args, options, executable = process.execPath) {
  const parameters = Array.isArray(args) ? args : [];
  const supplied = Array.isArray(args) ? options : args;
  const settings = supplied && typeof supplied === 'object' ? supplied : {};
  if (typeof command !== 'string') return { command, args: parameters, options: settings };
  const cwd = settings.cwd instanceof URL ? fileURLToPath(settings.cwd) : settings.cwd || process.cwd();
  const candidates = path.isAbsolute(command) ? [command] : command.includes('/') ? [path.resolve(cwd, command)] : String((settings.env || process.env).PATH || '').split(path.delimiter).map((directory) => path.resolve(cwd, directory, command));
  for (const candidate of candidates) {
    let descriptor;
    try {
      descriptor = fs.openSync(candidate, 'r');
      const header = Buffer.alloc(256), count = fs.readSync(descriptor, header, 0, header.length, 0);
      const firstLine = header.subarray(0, count).toString('utf8').split(/\r?\n/, 1)[0];
      if (/^#!.*\bnode(?:\s|$)/.test(firstLine)) return { command: executable, args: [candidate, ...parameters], options: settings };
      // PATH lookup stops at the first existing executable candidate. A native
      // program is left intact and may fail visibly if Android disallows it.
      break;
    } catch (error) { if (!['ENOENT', 'ENOTDIR', 'EACCES', 'EISDIR'].includes(error.code)) throw error; }
    finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
  }
  return { command, args: parameters, options: settings };
}

function installAndroidProcessAdapter({ executable = process.execPath, shell = process.env.SITEFOUNDRY_ANDROID_SHELL } = {}) {
  const childProcess = require('node:child_process');
  for (const method of ['spawn', 'spawnSync']) {
    const original = childProcess[method];
    childProcess[method] = function (command, args, options) {
      const adapted = adaptNodeCommand(command, args, options, executable);
      return original.call(this, adapted.command, adapted.args, adapted.options);
    };
  }
  for (const method of ['execFile', 'execFileSync']) {
    const original = childProcess[method];
    childProcess[method] = function (command, args, options, callback) {
      const adapted = adaptNodeCommand(command, typeof args === 'function' ? undefined : args, options, executable);
      const done = typeof args === 'function' ? args : typeof options === 'function' ? options : callback;
      return done ? original.call(this, adapted.command, adapted.args, adapted.options, done) : original.call(this, adapted.command, adapted.args, adapted.options);
    };
  }
  if (shell) {
    for (const method of ['exec', 'execSync']) {
      const original = childProcess[method];
      childProcess[method] = function (command, options, callback) {
        const settings = typeof options === 'object' && options ? options : {};
        const adapted = { ...settings, shell: !settings.shell || settings.shell === '/bin/sh' ? shell : settings.shell };
        const done = typeof options === 'function' ? options : callback;
        return done ? original.call(this, command, adapted, done) : original.call(this, command, adapted);
      };
    }
  }
  // Node's special promisified exec/execFile API returns both output streams and
  // attaches .child. Preserve that contract after replacing the exported method.
  for (const method of ['execFile', ...(shell ? ['exec'] : [])]) {
    const wrapped = childProcess[method];
    wrapped[promisify.custom] = function (...args) {
      let child;
      const result = new Promise((resolve, reject) => {
        child = wrapped(...args, (error, stdout, stderr) => {
          if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); }
          else resolve({ stdout, stderr });
        });
      });
      result.child = child;
      return result;
    };
  }
  require('node:module').syncBuiltinESMExports();
}

module.exports = { adaptNodeCommand, installAndroidProcessAdapter };
if (process.platform === 'android') installAndroidProcessAdapter();
