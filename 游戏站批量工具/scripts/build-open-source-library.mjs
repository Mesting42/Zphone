import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT = path.join(ROOT, 'js', 'open-source-games-bundle.js');
const REPO = 'wangzifan396-wzf/mini-browser-games';
const FIRST_BATCH_SIZE = 72;
const USER_AGENT = 'GameSiteBatchBuilder/1.2';

function titleFromSlug(filename) {
    const special = { moba: 'MOBA', '2048': '2048', atc: 'ATC', ai: 'AI' };
    return filename.replace(/\.html$/i, '').split('-').map(function(part) {
        return special[part.toLowerCase()] || part.charAt(0).toUpperCase() + part.slice(1);
    }).join(' ');
}

function decodeHtml(value) {
    return String(value || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function classify(filename) {
    const slug = filename.toLowerCase();
    const rules = [
        ['Sports', /(hockey|billiards|racer|curling|golf|court|penalty|touchline)/],
        ['Action', /(arena|moba|storm|tank|vanguard|horde|duel|dash|slice|chase)/],
        ['Puzzle', /(2048|gem|merge|mosaic|crossword|cipher|escape|maze|grid|alchemy|lockmaster|clues)/],
        ['Strategy', /(chess|tactics|command|fleet|sovereign|auction|frontier|backpack|holdem|inspector)/],
        ['Simulation', /(farm|market|ecosystem|studio|workshop|traffic|laboratory|harbor|keeper|calibrator)/],
        ['Adventure', /(shan-hai|dungeon|delver|moon|island|forest|monster|starforge|abyss|shadow|courier)/]
    ];
    for (const [name, pattern] of rules) {
        if (pattern.test(slug)) return name;
    }
    return 'Arcade';
}

function descriptionFor(title, category, originalTitle) {
    const categoryCopy = {
        Action: 'fast reactions and tactical movement',
        Adventure: 'exploration, progression and discovery',
        Arcade: 'quick sessions and score-driven play',
        Puzzle: 'clear rules and satisfying problem solving',
        Simulation: 'hands-on systems and meaningful choices',
        Sports: 'timing, aim and skill-based challenges',
        Strategy: 'planning, resource decisions and replayable tactics'
    };
    const original = originalTitle && originalTitle !== title ? ` Originally titled “${originalTitle}”.` : '';
    return `${title} is a self-contained browser game built around ${categoryCopy[category] || 'instant interactive play'}. It runs locally with touch and desktop controls, without relying on a third-party game server.${original}`;
}

async function fetchText(url, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
            if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
            return await response.text();
        } catch (error) {
            lastError = error;
            if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 500));
        }
    }
    throw lastError;
}

async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;
    async function run() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await worker(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
}

function findBrowser() {
    const candidates = process.platform === 'win32'
        ? [
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ]
        : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
    return candidates.find(candidate => {
        try { return require('node:fs').existsSync(candidate); } catch (_) { return false; }
    });
}

function fallbackCover(title, category, index) {
    const palettes = [
        ['#081b24', '#18d7b5', '#d9fff6'],
        ['#211329', '#ff6b9d', '#fff0f6'],
        ['#1b1809', '#f5b942', '#fff7d6'],
        ['#10162b', '#67a7ff', '#eaf2ff']
    ];
    const [bg, accent, text] = palettes[index % palettes.length];
    const safeTitle = title.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const safeCategory = category.replace(/[&<>"']/g, '');
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="${bg}"/><path d="M0 590L1280 190V720H0Z" fill="${accent}" opacity=".14"/><circle cx="1050" cy="120" r="260" fill="none" stroke="${accent}" stroke-width="3" opacity=".4"/><text x="78" y="92" fill="${accent}" font-family="Arial,sans-serif" font-size="26" font-weight="700" letter-spacing="7">${safeCategory.toUpperCase()} / LOCAL PLAY</text><text x="78" y="372" fill="${text}" font-family="Arial,sans-serif" font-size="76" font-weight="800">${safeTitle}</text><rect x="78" y="430" width="168" height="10" rx="5" fill="${accent}"/><text x="78" y="622" fill="${text}" opacity=".68" font-family="Arial,sans-serif" font-size="24">OPEN-SOURCE HTML5 GAME</text></svg>`);
}

async function makeCovers(games, tempDir) {
    let playwright = null;
    let sharp = null;
    try { playwright = require('playwright'); } catch (_) {}
    try { sharp = require('sharp'); } catch (_) {}
    const browserExecutable = findBrowser();
    if (!playwright || !browserExecutable) {
        console.warn('Browser automation unavailable; generating vector fallback covers.');
        return games.map(function(game, index) {
            return { mime: 'image/svg+xml', ext: 'svg', buffer: fallbackCover(game.title, game.category, index) };
        });
    }

    const browser = await playwright.chromium.launch({
        executablePath: browserExecutable,
        headless: true,
        args: ['--allow-file-access-from-files', '--mute-audio', '--disable-gpu']
    });
    try {
        return await mapLimit(games, 4, async function(game, index) {
            const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
            try {
                await page.emulateMedia({ reducedMotion: 'reduce' });
                await page.goto(pathToFileURL(game.tempPath).href, { waitUntil: 'load', timeout: 12000 });
                await page.waitForTimeout(900);
                const png = await page.screenshot({ type: 'png', fullPage: false });
                if (sharp) {
                    const webp = await sharp(png).resize(1280, 720, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
                    return { mime: 'image/webp', ext: 'webp', buffer: webp };
                }
                return { mime: 'image/png', ext: 'png', buffer: png };
            } catch (error) {
                console.warn(`Cover fallback for ${game.filename}: ${error.message}`);
                return { mime: 'image/svg+xml', ext: 'svg', buffer: fallbackCover(game.title, game.category, index) };
            } finally {
                await page.close();
            }
        });
    } finally {
        await browser.close();
    }
}

function buildCategoryPreset(games) {
    const featured = games.slice(0, 2);
    const rest = games.slice(2).sort(function(a, b) {
        return a.category.localeCompare(b.category) || a.sourceRank.localeCompare(b.sourceRank) || a.title.localeCompare(b.title);
    });
    const ordered = featured.concat(rest);
    const categories = [{ name: 'Featured Games', icon: '🌟', count: 2 }];
    const seenNames = {};
    for (let start = 2; start < ordered.length; start += 6) {
        const chunk = ordered.slice(start, start + 6);
        const counts = {};
        chunk.forEach(game => { counts[game.category] = (counts[game.category] || 0) + 1; });
        const dominant = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'More';
        seenNames[dominant] = (seenNames[dominant] || 0) + 1;
        const suffix = seenNames[dominant] > 1 ? ` ${seenNames[dominant]}` : '';
        const icons = { Action: '⚔️', Adventure: '🗺️', Arcade: '👾', Puzzle: '🧩', Simulation: '🤖', Sports: '⚽', Strategy: '🎯' };
        categories.push({ name: `${dominant} Games${suffix}`, icon: icons[dominant] || '🎮', count: 6 });
    }
    return { ordered, categories };
}

async function main() {
    console.log(`Building the first ${FIRST_BATCH_SIZE}-game open-source catalog...`);
    const repoMeta = JSON.parse(await fetchText(`https://api.github.com/repos/${REPO}`));
    const branch = repoMeta.default_branch || 'main';
    const commitMeta = JSON.parse(await fetchText(`https://api.github.com/repos/${REPO}/commits/${branch}`));
    const commit = commitMeta.sha;
    const tiers = JSON.parse(await fetchText(`https://raw.githubusercontent.com/${REPO}/${commit}/GAME_TIERS.json`));
    const ranked = ['SSS', 'SS', 'S', 'A'].flatMap(rank => (tiers.tiers[rank] || []).map(filename => ({ filename, rank })));
    const selected = ranked.slice(0, FIRST_BATCH_SIZE);
    if (selected.length !== FIRST_BATCH_SIZE) throw new Error(`Expected ${FIRST_BATCH_SIZE} games, found ${selected.length}`);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-site-open-source-'));
    try {
        const downloaded = await mapLimit(selected, 10, async function(entry, index) {
            const sourceHtml = await fetchText(`https://raw.githubusercontent.com/${REPO}/${commit}/${entry.filename}`);
            const originalTitle = decodeHtml((sourceHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
            const title = titleFromSlug(entry.filename);
            const category = classify(entry.filename);
            const tempPath = path.join(tempDir, entry.filename);
            await fs.writeFile(tempPath, sourceHtml, 'utf8');
            process.stdout.write(`\rDownloaded ${index + 1}/${selected.length}`);
            return {
                id: `oss-${entry.filename.replace(/\.html$/i, '')}`,
                filename: entry.filename,
                title,
                originalTitle,
                category,
                sourceRank: entry.rank,
                description: descriptionFor(title, category, originalTitle),
                sourceHtml,
                tempPath
            };
        });
        process.stdout.write('\nCapturing 1280x720 covers...\n');
        const covers = await makeCovers(downloaded, tempDir);
        downloaded.forEach(function(game, index) {
            const cover = covers[index];
            game.coverFile = `${game.filename.replace(/\.html$/i, '')}.${cover.ext}`;
            game.coverData = `data:${cover.mime};base64,${cover.buffer.toString('base64')}`;
        });

        const categoryLayout = buildCategoryPreset(downloaded);
        const licenseText = await fetchText(`https://raw.githubusercontent.com/${REPO}/${commit}/LICENSE`);
        const bundle = {
            schemaVersion: 1,
            generatedAt: new Date().toISOString(),
            source: {
                label: 'Open-source local · first batch',
                repository: `https://github.com/${REPO}`,
                revision: commit,
                license: 'MIT',
                licenseText
            },
            categoryPreset: categoryLayout.categories,
            games: categoryLayout.ordered.map(function(game) {
                return {
                    id: game.id,
                    title: game.title,
                    originalTitle: game.originalTitle,
                    description: game.description,
                    category: game.category,
                    sourceRank: game.sourceRank,
                    source: 'opensource-local',
                    sourceRepo: `https://github.com/${REPO}`,
                    url: `games/${game.filename}`,
                    thumb: game.coverFile,
                    width: 1280,
                    height: 720,
                    gameFile: game.filename,
                    gameHtml: game.sourceHtml,
                    coverFile: game.coverFile,
                    coverData: game.coverData
                };
            })
        };

        const javascript = `/* Generated by scripts/build-open-source-library.mjs. Source: ${REPO} (${commit}). */\nwindow.OPEN_SOURCE_GAME_BUNDLE = ${JSON.stringify(bundle)};\n`;
        await fs.writeFile(OUTPUT, javascript, 'utf8');
        const stats = await fs.stat(OUTPUT);
        console.log(`Wrote ${path.relative(ROOT, OUTPUT)} (${Math.round(stats.size / 1024)} KiB, ${bundle.games.length} games).`);
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

main().catch(function(error) {
    console.error(error);
    process.exitCode = 1;
});
