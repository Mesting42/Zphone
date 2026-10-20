// This is a functional offline guarantee for Node HTTP/socket APIs. It is not a
// sandbox for arbitrary imported native programs. Native containers also supply
// device offline/network-blocked acceptance evidence before claiming validation.
'use strict';
const allowed = (host) => !host || /^(?:localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i.test(String(host));
function hostname(options) {
  if (options.hostname) return options.hostname;
  const host = options.host;
  if (!host) return undefined;
  if (String(host).startsWith('[')) return String(host).slice(0, String(host).indexOf(']') + 1);
  return String(host).includes(':') && !String(host).includes('::') ? String(host).split(':')[0] : host;
}
function reject(host) {
  if (!allowed(host)) {
    const error = new Error('OFFLINE_NETWORK_BLOCKED: ' + host);
    error.code = 'OFFLINE_NETWORK_BLOCKED';
    throw error;
  }
}
for (const name of ['node:http', 'node:https']) {
  const api = require(name);
  for (const method of ['request', 'get']) {
    const original = api[method];
    api[method] = function (...args) {
      const input = args[0];
      if (typeof input === 'string' || input instanceof URL) reject(new URL(input).hostname);
      else if (input && typeof input === 'object') reject(hostname(input));
      return original.apply(this, args);
    };
  }
}
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, ...args) {
  reject(new URL(typeof input === 'string' || input instanceof URL ? input : input.url).hostname);
  return originalFetch(input, ...args);
};
const net = require('node:net'), originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let options = args[0];
  if (Array.isArray(options)) options = options[0];
  if (options && typeof options === 'object') reject(options.host || options.hostname);
  else if (typeof options === 'number' && typeof args[1] === 'string') reject(args[1]);
  return originalConnect.apply(this, args);
};
const tls = require('node:tls'), originalTlsConnect = tls.connect;
tls.connect = function (...args) {
  const options = args.find((value) => value && typeof value === 'object');
  reject(options?.host || options?.hostname || (typeof args[1] === 'string' ? args[1] : undefined));
  return originalTlsConnect.apply(this, args);
};

// DNS and UDP can contact the network without an HTTP/TCP call. Protect these
// too, including promise APIs and ESM named exports of the builtin modules.
for (const api of [require('node:dns'), require('node:dns').promises]) {
  for (const name of Object.keys(api).filter((key) => key === 'lookup' || key === 'lookupService' || key.startsWith('resolve') || key === 'reverse')) {
    if (typeof api[name] !== 'function') continue;
    const original = api[name];
    api[name] = function (host, ...args) { reject(host); return original.call(this, host, ...args); };
  }
}
const dgram = require('node:dgram');
for (const method of ['connect', 'send']) {
  const original = dgram.Socket.prototype[method];
  dgram.Socket.prototype[method] = function (...args) {
    if (method === 'connect') reject(typeof args[1] === 'string' ? args[1] : undefined);
    else {
      // send(buf, port, address) and send(buf, offset, length, port, address).
      const addressIndex = typeof args[2] === 'number' ? 4 : 2;
      reject(typeof args[addressIndex] === 'string' ? args[addressIndex] : undefined);
    }
    return original.apply(this, args);
  };
}
require('node:module').syncBuiltinESMExports();
