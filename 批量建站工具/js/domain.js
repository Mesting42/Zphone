/**
 * 本地内容领域识别器。
 * 只分析上传数据的字段名和少量文本样本，不发起网络请求。
 */
(function(global) {
    'use strict';

    function normalize(value) {
        return String(value == null ? '' : value).toLowerCase().replace(/[_-]+/g, ' ');
    }

    function includesKeyword(text, keyword) {
        var normalizedKeyword = normalize(keyword).trim();
        if (!normalizedKeyword) return false;
        if (/^[a-z0-9 ]+$/.test(normalizedKeyword)) {
            return new RegExp('(?:^|\\W)' + normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|\\W)', 'i').test(text);
        }
        return text.indexOf(normalizedKeyword) !== -1;
    }

    function collectSample(rows) {
        var sampleRows = rows.slice(0, 30);
        var fields = {};
        var weightedText = '';
        var bodyText = '';

        sampleRows.forEach(function(row) {
            if (!row || typeof row !== 'object' || Array.isArray(row)) return;
            Object.keys(row).forEach(function(key) {
                fields[normalize(key).trim()] = true;
                var value = row[key];
                if (value == null || typeof value === 'object') return;
                var text = normalize(value).slice(0, 1200);
                if (/title|name|category|genre|tag|topic|标题|分类|类型|栏目/i.test(key)) {
                    weightedText += ' ' + text + ' ' + text;
                } else {
                    bodyText += ' ' + text;
                }
            });
        });

        return {
            fields: Object.keys(fields),
            headlineText: weightedText.slice(0, 30000),
            text: (weightedText + ' ' + bodyText).slice(0, 80000)
        };
    }

    function detect(rows, catalog) {
        var sample = collectSample(Array.isArray(rows) ? rows : []);
        var results = Object.keys(catalog || {}).map(function(id) {
            var profile = catalog[id];
            var score = 0;
            var evidence = [];

            (profile.fieldSignals || []).forEach(function(signal) {
                var normalizedSignal = normalize(signal).trim();
                var matched = sample.fields.find(function(field) {
                    return field === normalizedSignal || field.indexOf(normalizedSignal) !== -1;
                });
                if (matched) {
                    score += 9;
                    evidence.push('字段 “' + matched + '”');
                }
            });

            (profile.keywords || []).forEach(function(keyword) {
                var keywordText = normalize(keyword).replace(/\s+/g, '');
                var searchableText = keywordText.length <= 2 ? sample.headlineText : sample.text;
                if (includesKeyword(searchableText, keyword)) {
                    score += 2;
                    if (evidence.length < 5) evidence.push('关键词 “' + keyword + '”');
                }
            });

            return { id: id, label: profile.label, score: score, evidence: evidence.slice(0, 5) };
        }).sort(function(a, b) { return b.score - a.score; });

        var rankedResults = results.filter(function(item) { return item.id !== 'general'; });
        var best = rankedResults[0] || { id: null, label: '', score: 0, evidence: [] };
        var second = rankedResults[1] || { score: 0 };
        var confidence = best.score > 0
            ? Math.round(Math.min(98, 48 + (best.score / Math.max(1, best.score + second.score)) * 37 + Math.min(13, best.score / 4)))
            : 0;
        var margin = best.score - second.score;
        var reliable = best.score >= 6 && (margin >= 3 || (best.score >= 18 && best.score >= second.score * 1.35));

        var fallbackId = catalog && catalog.general ? 'general' : null;
        var fallbackUsed = !reliable && !!fallbackId;
        return {
            id: reliable ? best.id : null,
            suggestedId: reliable ? best.id : (fallbackId || (best.score > 0 ? best.id : null)),
            label: best.label,
            confidence: reliable ? confidence : Math.min(confidence, 58),
            evidence: best.evidence,
            scores: rankedResults,
            reliable: reliable,
            fallbackUsed: fallbackUsed
        };
    }

    global.DomainEngine = { detect: detect, collectSample: collectSample };
})(typeof window !== 'undefined' ? window : globalThis);
