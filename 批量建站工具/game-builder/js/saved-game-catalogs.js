/**
 * 本地内置游戏目录
 * 目录、图片 Blob 与本地游戏文件仅保存到当前浏览器的 IndexedDB，不会上传到网络。
 */
const SavedGameCatalogs = (function() {
    'use strict';

    const DB_NAME = 'game-site-batch-builder';
    const DB_VERSION = 1;
    const STORE_NAME = 'saved-catalogs';

    function isAvailable() {
        return typeof indexedDB !== 'undefined';
    }

    function openDatabase() {
        if (!isAvailable()) {
            return Promise.reject(new Error('当前浏览器不支持本地目录存储（IndexedDB）。'));
        }
        return new Promise(function(resolve, reject) {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = function() {
                const database = request.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            request.onsuccess = function() { resolve(request.result); };
            request.onerror = function() { reject(request.error || new Error('无法打开本地目录存储。')); };
            request.onblocked = function() { reject(new Error('本地目录存储被其他页面占用，请关闭同一工具的其他页面后重试。')); };
        });
    }

    function runRequest(mode, callback) {
        return openDatabase().then(function(database) {
            return new Promise(function(resolve, reject) {
                let transaction;
                try {
                    transaction = database.transaction(STORE_NAME, mode);
                } catch (error) {
                    database.close();
                    reject(error);
                    return;
                }
                const request = callback(transaction.objectStore(STORE_NAME));
                request.onsuccess = function() { resolve(request.result); };
                request.onerror = function() { reject(request.error || new Error('本地目录操作失败。')); };
                transaction.oncomplete = function() { database.close(); };
                transaction.onabort = function() { database.close(); };
            });
        });
    }

    function safeName(value) {
        const name = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
        return name.slice(0, 60) || '未命名游戏目录';
    }

    function fingerprintData(data) {
        const rows = Array.isArray(data) ? data : [];
        const normalized = rows.map(function(item) {
            const row = item && typeof item === 'object' ? item : {};
            return ['id', 'title', 'url', 'thumb', 'description'].map(function(key) {
                return String(row[key] == null ? '' : row[key]).trim();
            }).join('\u001f');
        }).sort().join('\u001e');
        let hash = 0x811c9dc5;
        for (let index = 0; index < normalized.length; index++) {
            hash ^= normalized.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        return 'g' + rows.length + '-' + (hash >>> 0).toString(36).padStart(7, '0');
    }

    function newId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return 'catalog-' + crypto.randomUUID();
        }
        return 'catalog-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    function save(record) {
        const now = new Date().toISOString();
        const normalized = Object.assign({}, record, {
            id: record && record.id ? String(record.id) : newId(),
            name: safeName(record && record.name),
            fingerprint: fingerprintData(record && record.data),
            createdAt: record && record.createdAt ? record.createdAt : now,
            updatedAt: now,
            schemaVersion: 1
        });
        return runRequest('readwrite', function(store) {
            return store.put(normalized);
        }).then(function() {
            return normalized;
        });
    }

    function get(id) {
        return runRequest('readonly', function(store) {
            return store.get(String(id));
        });
    }

    function list() {
        return runRequest('readonly', function(store) {
            return store.getAll();
        }).then(function(records) {
            return (records || []).map(function(record) {
                return {
                    id: record.id,
                    name: safeName(record.name),
                    createdAt: record.createdAt || '',
                    updatedAt: record.updatedAt || '',
                    gameCount: Array.isArray(record.data) ? record.data.length : 0,
                    fingerprint: record.fingerprint || fingerprintData(record.data)
                };
            }).sort(function(a, b) {
                return String(b.updatedAt).localeCompare(String(a.updatedAt));
            });
        });
    }

    function remove(id) {
        return runRequest('readwrite', function(store) {
            return store.delete(String(id));
        });
    }

    function rename(id, name) {
        return get(id).then(function(record) {
            if (!record) throw new Error('找不到要重命名的本地内置目录。');
            return save(Object.assign({}, record, {
                id: String(id),
                name: name,
                createdAt: record.createdAt
            }));
        });
    }

    return {
        isAvailable: isAvailable,
        save: save,
        get: get,
        list: list,
        fingerprintData: fingerprintData,
        rename: rename,
        remove: remove
    };
})();
