import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const builder = readFileSync(new URL('../js/batch-ad-builder.js', import.meta.url), 'utf8');
const adRestoration = readFileSync(new URL('../js/ad-restoration.js', import.meta.url), 'utf8');
const previewRouter = readFileSync(new URL('../js/ad-injection-preview-router.js', import.meta.url), 'utf8');
const finishedSiteAds = readFileSync(new URL('../js/finished-site-ads.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/tool.css', import.meta.url), 'utf8');

describe('batch ad upload formats', () => {
  it('offers a labeled all-articles toggle and preview tab for generated-content workflows', () => {
    expect(html).toContain('<label for="all-articles-enabled">全部文章页面</label>');
    expect(html).toContain('id="all-articles-enabled" checked aria-describedby="all-articles-help"');
    expect(html).toContain('class="preview-tab" data-page="all" hidden>全部文章</button>');
    expect(app).toContain("var normalMode = ['normal', 'ad-migration', 'batch-ad-build'].indexOf(appState.siteBuildMode) !== -1;");
    expect(app).toContain("tab.hidden = !enabled;");
    expect(app).toContain("appState.config.allArticlesEnabled = this.checked;");
    expect(app).toContain("if (currentPage === 'all') currentPage = 'detail';");
    expect(app).toContain("var detailTab = document.querySelector('.preview-tab[data-page=\"detail\"]');");
    expect(builder).toContain('config.allArticlesEnabled = config.allArticlesEnabled !== false;');
  });

  it('always includes the complete color-theme library when randomizing a template', () => {
    const randomConfig = app.slice(app.indexOf('function generateRandomConfig()'), app.indexOf('function applyConfigToUI()'));

    expect(randomConfig).toContain("c.selectedStyle = randomPick(STYLE_PRESETS.map(function(s) { return s.id; }));");
    expect(randomConfig).not.toContain('if (Math.random() > 0.55) c.selectedStyle');
    expect(html).toContain('随机应用一套领域专属模板与配色主题');
  });

  it('offers RAR and 7Z alongside JSON and ZIP in the batch file selector', () => {
    expect(html).toMatch(/id="batch-data-input"[^>]*\.rar[^>]*\.7z/);
    expect(html).toContain('id="batch-data-progress"');
    expect(html).toContain('id="upload-import-progress"');
    expect(app).toContain('function setBatchDataImportProgress(percent, message, state)');
    expect(app).toContain('function setSingleImportProgress(percent, message, state)');
    expect(app).toContain('正在读取第 ');
  });

  it('offers fixed and manual positions for uploaded batch ads with global defaults and site overrides', () => {
    expect(html).toContain('id="direct-ad-placement-mode-group"');
    expect(html).toContain('id="batch-code-placement-scope"');
    expect(html).toContain('id="batch-code-placement-override"');
    expect(app).toContain('function getBatchCodePlacementEditingTarget(site)');
    expect(app).toContain('function persistBatchCodePlacementUiState()');
    expect(builder).toContain('function resolveCodePlacementSettings(batch, site)');
    expect(builder).toContain('directAdPlacementMode: reserve ? \'fixed\' : codePlacementSettings.placementMode');
    expect(app).toContain('persistBatchCodePlacementUiState();');
  });

  it('keeps batch ad-code names on one line in a wider, keyboard-accessible select menu', () => {
    expect(app).toContain("Math.max(rect.width, 340)");
    expect(app).toContain("menu.classList.add('batch-ad-code-select-menu')");
    expect(app).toContain("optionButton.setAttribute('aria-label', option.title || optionButton.textContent)");
    expect(app).toContain("title=\"' + escapeHtml(label) + '\">");
    expect(css).toContain('.batch-ad-code-select-menu .select-option { overflow:hidden;white-space:nowrap;text-overflow:ellipsis; }');
  });

  it('re-enables and resets the batch data picker after a parse failure', () => {
    expect(app).toContain("setBatchDataImportProgress(100, '解析失败：' + (error && error.message ? error.message : '请检查数据源后重试。'), 'error');");
    expect(app).toContain('if (button) button.disabled = isLoading;');
    expect(app).toContain('if (input) input.disabled = isLoading;');
    expect(app).toContain("dataInput.value = ''; dataInput.click();");
  });

  it('re-exposes single-source parsing progress after a user chooses to re-upload', () => {
    const beginImport = app.slice(app.indexOf('function beginSingleDataImport(file)'), app.indexOf('function finishSingleDataImport(file)'));

    expect(beginImport).toContain('uploadArea.hidden = false;');
    expect(beginImport).toContain("setSingleImportProgress(3, '正在读取 ' + file.name + '…', 'loading');");
  });

  it('uses the ZIP export progress presentation for single-source parsing', () => {
    expect(html).toContain('class="export-progress upload-import-progress" id="upload-import-progress"');
    expect(html).toContain('<span>解析进度</span>');
    expect(html).toContain('id="upload-import-progress-value">0%</output>');
    expect(html).toContain('class="progress-bar"');
    expect(html).toContain('class="progress-fill" id="upload-import-progress-fill"');
    expect(html).toContain('class="progress-text" id="upload-import-progress-text"');
    expect(app).toContain("var value = document.getElementById('upload-import-progress-value');");
    expect(app).toContain("if (value) value.textContent = safePercent + '%';");
  });

  it('routes RAR and 7Z through the existing local archive runtime and retains assets', () => {
    expect(app).toContain("ext === 'rar' || ext === '7z'");
    expect(app).toContain('ensureArchiveRuntime()');
    expect(app).toContain('archive.getFilesArray()');
    expect(app).toContain('localImages[');
  });

  it('keeps a local image map and independent configuration for the active preview site', () => {
    expect(html).toContain('id="batch-preview-site-tabs"');
    expect(app).toContain('function syncBatchActiveSiteToApp()');
    expect(app).toContain('appState.localImages = site.localImages || {}');
    expect(app).toContain('site.config = cloneBatchConfig(appState.config)');
    expect(app).toContain('function switchBatchPreviewSite(index, shouldFocus)');
  });

  it('exposes a labeled preview site switcher and prevents duplicate template selection', () => {
    const previewSwitcherStyles = css.slice(css.indexOf('/* 预览工具栏按“状态 + 浏览 + 设备”分组'), css.indexOf('.template-card.is-unavailable'));

    expect(html).toContain('id="preview-site-switcher"');
    expect(html).toContain('站点');
    expect(app).toContain('function batchSiteDisplayName(site)');
    expect(app).toContain("replace(/\\.(?:json|zip|rar|7z)$/i, '')");
    expect(app).toContain('escapeHtml(displayName)');
    expect(previewSwitcherStyles).toContain('scrollbar-width: thin;');
    expect(previewSwitcherStyles).toContain('flex: 0 0 auto;');
    expect(previewSwitcherStyles).toContain('width: fit-content;');
    expect(previewSwitcherStyles).toContain('min-width: 0;');
    expect(previewSwitcherStyles).not.toContain('min-width: 96px;');
    expect(app).toContain('function getBatchTemplateOwner(templateId, exceptSite)');
    expect(builder).toContain('BATCH_TEMPLATE_REUSED');
    expect(app).toContain('data-template-unavailable="true"');
  });

  it('keeps domain recognition independent for every batch data source', () => {
    expect(html).toContain('id="batch-domain-site-tabs"');
    expect(app).toContain('function renderBatchDomainSiteTabs()');
    expect(app).toContain('function switchBatchDomainSite(index, shouldFocus)');
    expect(app).toContain('site.domainDetection = DomainEngine.detect(site.data, DOMAIN_CATALOG');
    expect(app).toContain('site.themeId = themeId;');
    expect(builder).toContain('selectedTheme: site.themeId || appState.selectedTheme');
  });

  it('uses the full field-mapping width and gives imported data rows a consistent readable surface', () => {
    expect(css).toContain('.batch-field-mapping { grid-column:1 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));');
    expect(css).toContain('.batch-ad-data-item { background:#f8fcff; }');
    expect(css).toContain('.batch-ad-data-item strong,.batch-ad-code-item strong { overflow:hidden;color:#244e6b;');
  });

  it('balances the seven workflow cards into four cards followed by three full-width peers', () => {
    expect(css).toContain('@media (min-width: 1280px)');
    expect(css).toContain('.build-mode-options { grid-template-columns: repeat(12, minmax(0, 1fr)); }');
    expect(css).toContain('.build-mode-card:nth-child(5),');
    expect(css).toContain('.build-mode-card:nth-child(7) { grid-column: span 4; }');
  });

  it('offers an explicit batch policy ad.js version choice without changing the default', () => {
    expect(html).toContain('id="ad-policy-ad-version"');
    expect(html).toContain('<option value="original">保留各站原版（默认）</option>');
    expect(html).toContain('<option value="v1.0.0">统一切换到 v1.0.0</option>');
    expect(html).toContain('<option value="v1.0.1">统一切换到 v1.0.1</option>');
    expect(html).toContain('<option value="v1.0.2">统一切换到 v1.0.2</option>');
    expect(html).toContain('<option value="v1.0.2.1">统一切换到 v1.0.2.1</option>');
    expect(app).toContain("adPolicyAdJsVersion: 'original'");
    expect(app).toContain("{ adJsVersionMode: appState.adPolicyAdJsVersion }");
    expect(app).toContain("metadata.adJsVersion + (outputVersion !== metadata.adJsVersion ? ' → 输出 ' + outputVersion : '')");
    expect(adRestoration).toContain("const BATCH_AD_JS_VERSIONS = ['v1.0.0', 'v1.0.1', 'v1.0.2', 'v1.0.2.1'];");
    expect(adRestoration).toContain('const adJsVersionMode = normalizeBatchAdJsVersionMode(options.adJsVersionMode);');
    expect(adRestoration).toContain('sourceAdJsVersion: metadata.adJsVersion');
  });

  it('keeps batch item numbers high-contrast against their blue badges', () => {
    expect(css).toContain('.batch-ad-step,.batch-ad-item-index { display:grid;width:32px;height:32px;');
    expect(css).toContain('background:#0b6fa8;color:#fff !important;');
  });

  it('uses a guided upload-configure-export flow for finished-site ad injection', () => {
    const injectionControls = app.slice(app.indexOf('function initAdInjectionControls()'), app.indexOf('function differentiatedManifestSite()'));
    const differentiatedCategories = app.slice(app.indexOf('function renderDifferentiatedCategories()'), app.indexOf('function renderDifferentiatedHomeCategories()'));

    expect(html).toContain('上传已过审网站压缩包');
    expect(html).toContain('id="ad-injection-config-panel"');
    expect(html).toContain('id="injection-code-input"');
    expect(html).toContain('id="injection-policy-grid"');
    expect(html).toContain('id="ad-injection-export-options"');
    expect(app).toContain('function injectionWorkflowSteps()');
    expect(app).toContain('return [1, 4, 5];');
    expect(app).toContain('function nextWorkflowStep()');
    expect(app).toContain('function syncWorkflowNavigation()');
    expect(app).toContain("btnNext.dataset.nextStep = String(nextWorkflowStep() || '')");
    expect(app).toContain("step === 1 ? '进入配置网站 →'");
    expect(app).toContain('var targetStep = nextWorkflowStep();');
    expect(app).toContain('if (appState.currentStep === step && step !== prevStep)');
    expect(app).toContain('function updateAdInjectionPreview(pageType, entryPath)');
    expect(app).toContain('function buildAdInjectionPreviewDocument(site, pageType, entryPath)');
    expect(app).toContain("previewFrame.setAttribute('sandbox', 'allow-scripts')");
    expect(app).toContain('getAdInjectionPolicy()');
    expect(app).toContain('var exportSites = await prepareAdInjectionExportSites(appState.adInjectionSites, exportMode)');
    expect(app).toContain('applyAdCodeBatch(exportSites, appState.adInjectionCodes');
    expect(app).toContain('overrides: appState.adInjectionSiteOverrides');
    expect(app).toContain('}, injectReactSource, sourceExporter);');
    expect(injectionControls).toContain('if (pasteButton && pastePanel)');
    expect(injectionControls).toContain("if (parsePaste) parsePaste.addEventListener('click'");
    expect(injectionControls).toContain("if (allowPartial) allowPartial.addEventListener('change'");
    expect(injectionControls).toContain("if (fields) fields.addEventListener('input'");
    expect(differentiatedCategories).not.toContain('pasteButton');
    expect(differentiatedCategories).not.toContain('parsePaste');
    expect(differentiatedCategories).not.toContain('allowPartial');
    expect(app).toContain('function renderAdInjectionPlacementControls(grid)');
    expect(app).toContain("event.data.type !== 'ad-injection-place'");
    expect(app).toContain('function mountAdInjectionPlacementOverlay');
    expect(html).toContain('name="injection-placement-mode"');
    expect(html).toContain('id="injection-fixed-warnings"');
    expect(css).toContain('.injection-ad-select-btn.is-active');
  });

  it('keeps finished-site configuration focused on ads without changing other workflows tabs', () => {
    const injectionPanel = html.slice(html.indexOf('<aside class="config-panel ad-injection-config-panel"'), html.indexOf('<div class="config-panel">', html.indexOf('<aside class="config-panel ad-injection-config-panel"')));
    const configInitialization = app.slice(app.indexOf('function initAdInjectionConfig()'), app.indexOf('function renderAdInjectionResult'));

    expect(injectionPanel).toContain('id="ad-injection-config-title">配置广告</h2>');
    expect(injectionPanel).toContain('for="injection-preview-site"');
    expect(injectionPanel).toContain('<details class="injection-source-details">');
    expect(injectionPanel).toContain('id="injection-policy-grid"');
    expect(injectionPanel).not.toContain('injection-config-tab');
    expect(injectionPanel).not.toContain('样式配置');
    expect(configInitialization).not.toContain('injection-config-tab');
    expect(app).toContain('rebuildStyledSelect(select);');
    expect(app).toContain("trigger.setAttribute('aria-label', '实时预览站点');");
    expect(html).toContain('class="config-tab active" data-tab="structure"');
    expect(html).toContain('class="diff-config-tab active" data-diff-tab="identity"');
    expect(css).toContain('.injection-site-select select {');
    expect(css).toContain('.injection-site-select select:focus-visible {');
  });

  it('keeps the finished-site selector above following cards and wraps narrow mapping results', () => {
    expect(css).toContain('.ad-injection-config-panel > .injection-site-context { position:relative;z-index:2;');
    expect(css).toContain('.ad-injection-config-panel .injection-mapping-item { grid-template-columns:minmax(0,1fr);');
    expect(css).toContain('.ad-injection-config-panel .injection-mapping-item > * { min-width:0;overflow-wrap:anywhere; }');
    expect(css).toContain('.ad-injection-config-panel .injection-mapping-item strong { overflow:visible;white-space:normal;');
  });

  it('loads the current finished-site React injector through a versioned browser module', () => {
    expect(html).toMatch(/js\/app\.js\?v=[^"']+/);
    expect(app).toContain("./react-source-ad-injector.js?v=20260923-export-parity-2");
  });

  it('allows React source export while clearly separating it from a browser build', () => {
    expect(html).toContain('React 源码会导出加入广告后的完整工程');
    expect(html).toContain('请在项目环境自行执行 npm install 和 npm run build');
    expect(html).not.toContain('React 源码未真实构建时，整个导出会被阻止');
    expect(app).not.toContain("unbuiltReact.length > 0");
    expect(app).not.toContain("!unbuiltReactSites.length");
    expect(app).not.toContain('AD_EXPORT_REACT_BUILD_EXECUTOR_UNAVAILABLE');
  });

  it('embeds finished-site preview styles and assets without sandbox-blocked blob URLs', () => {
    const previewPipeline = app.slice(app.indexOf('function clearAdInjectionPreviewUrls()'), app.indexOf('function renderAdInjectionConfig()'));

    expect(previewPipeline).toContain('function adInjectionPreviewDataUrl');
    expect(previewPipeline).not.toContain('URL.createObjectURL');
    expect(previewPipeline).toContain("style-src data: 'unsafe-inline'");
    expect(previewPipeline).not.toContain('style-src blob:');
  });

  it('builds Node-authored static sources only inside the finished-site preview path', () => {
    expect(app).toContain("import { buildPreviewSite, previewBuildPlan } from './ad-injection-preview-builder.js?v=20260923-artifact-first-1';");
    expect(app).toContain('function ensureAdInjectionPreviewBuild(site)');
    expect(app).toContain('function adInjectionPreviewSourceEntries(site)');
    expect(app).toContain('site._previewBuild');
    expect(app).toContain('正在准备完整预览');
    expect(app).toContain('源压缩包和导出内容不会被修改');
    expect(adRestoration).toContain('function staticGeneratorPreviewRoot(rawEntries)');
    expect(adRestoration).toContain('previewRoot !== null');
  });

  it('prefers uploaded dist/build output before attempting a finished-site source rebuild', () => {
    expect(app).toContain('function adInjectionUploadedPreviewArtifact(site, entries)');
    expect(app).toContain('uploadedArtifact: true');
    expect(app).toContain("if (!site._previewBuild) {\n            site._previewBuild = adInjectionUploadedPreviewArtifact(site, previewSourceEntries);");
    expect(app).toContain('hasDedicatedPreviewSource && !hasUploadedArtifact');
    expect(app).toContain('dist|build|out|output|export|www|_site|public');
    expect(app).toContain('isPreviewDetailEntry(path, adInjectionPreviewRoot(preferredPath))');
    expect(previewRouter).toContain('details?|articles?|news|posts?|stories?|guides?|blog|tools|games?');
  });

  it('rewrites image paths created dynamically by finished-site JavaScript', () => {
    const previewPipeline = app.slice(app.indexOf('function rewriteAdInjectionPreviewModule'), app.indexOf('function isAdInjectionPreviewSourceShell'));

    expect(previewPipeline).toContain('Plain HTML sites often create cards and images from JavaScript data.');
    expect(previewPipeline).toContain('avif|gif|ico|jpe?g|png|svg|webp');
    expect(previewPipeline).toContain("assetUrls[resolved.toLowerCase()]");
    expect(previewPipeline).toContain('sitefoundry-preview-asset-request');
    expect(previewPipeline).toContain('installMemoryStorage("localStorage")');
  });

  it('keeps local static and compiled framework scripts executable in the isolated preview', () => {
    const previewPipeline = app.slice(app.indexOf('function resolveAdInjectionPreviewAsset'), app.indexOf('function currentAdInjectionPreviewPage'));

    expect(previewPipeline).toContain('function rewriteAdInjectionPreviewModule');
    expect(previewPipeline).toContain("script-src 'unsafe-inline' data:");
    expect(previewPipeline).toContain("doc.querySelectorAll('script[src]')");
    expect(previewPipeline).toContain("node.setAttribute('src', assetUrls[resolved.toLowerCase()])");
    expect(previewPipeline).not.toContain("doc.querySelectorAll('script, link[rel=\"modulepreload\"], link[rel=\"preload\"][as=\"script\"]')");
  });

  it('offers an opt-in Three.js and WebGL effect preview only for finished-site ad injection', () => {
    const previewPipeline = app.slice(app.indexOf('function rewriteAdInjectionPreviewModule'), app.indexOf('function currentAdInjectionPreviewPage'));
    const effectControl = app.slice(app.indexOf('function syncAdInjectionPreviewEffectsControl'), app.indexOf('function renderAdInjectionConfig'));

    expect(html).toContain('id="preview-effects-toggle"');
    expect(html).toContain('3D 关闭');
    expect(app).toContain('adInjectionPreviewEffectsEnabled: false');
    expect(effectControl).toContain("isAdInjectionWorkflow() && appState.currentStep === 4");
    expect(previewPipeline).toContain("'wasm-unsafe-eval'");
    expect(previewPipeline).toContain('connect-src data: blob: https: http: ws: wss:');
    expect(previewPipeline).toContain('frame-src data: blob: https: http:');
    expect(previewPipeline).toContain('buildAdInjectionEmbeddedPreviewDocument');
    expect(previewPipeline).toContain("String(node.tagName || '').toLowerCase() === 'iframe'");
    expect(previewPipeline).toContain('3D / 嵌套效果预览已关闭');
    expect(previewPipeline).toContain('已阻止它回退到建站工具地址');
    expect(previewPipeline).toContain('glb|gltf|bin|hdr|exr|ktx2?');
    expect(css).toContain('.preview-effects-toggle.is-active');
  });

  it('binds finished-site preview tabs and forwards the selected page to the renderer', () => {
    const updatePreview = app.slice(app.indexOf('function updatePreview(pageType)'), app.indexOf('if (appState.siteBuildMode === \'differentiated\'', app.indexOf('function updatePreview(pageType)')));
    const stepFour = app.slice(app.indexOf('// 步骤4：更新预览'), app.indexOf('function validateStep(step)'));

    expect(stepFour).toContain('if (injectionStep) {\n                initPreviewControls();');
    expect(updatePreview).toContain('updateAdInjectionPreview(pageType);');
  });

  it('keeps arbitrary internal links inside the uploaded-site preview', () => {
    const previewPipeline = app.slice(app.indexOf('function addAdInjectionPlacementMarkers'), app.indexOf('function currentAdInjectionPreviewPage'));
    const injectionMessages = app.slice(app.indexOf('function initAdInjectionConfig()'), app.indexOf('function renderAdInjectionResult'));

    expect(previewPipeline).toContain('function addAdInjectionPreviewNavigation');
    expect(previewPipeline).toContain("type:'ad-injection-preview-navigate'");
    expect(previewPipeline).toContain("document.addEventListener('click'");
    expect(previewPipeline).toContain('},true);');
    expect(previewPipeline).toContain("link.hasAttribute('download')");
    expect(previewPipeline).not.toContain("navigationScript.type = 'module'");
    expect(previewPipeline).not.toContain("var link=event.target.closest('a');if(link)event.preventDefault()");
    expect(injectionMessages).toContain("event.data.type === 'ad-injection-preview-navigate'");
    expect(injectionMessages).toContain('resolvePreviewHtmlEntry');
  });

  it('offsets top banner1 only when a custom scroll progress rail follows navigation', () => {
    expect(finishedSiteAds).toContain('function adjacentScrollProgress');
    expect(finishedSiteAds).toContain("unit === 'banner1' && anchor === header && relation === 'after'");
    expect(finishedSiteAds).toContain('@media (min-width:720px){[data-sitefoundry-after-nav-offset]{margin-top:24px!important;}}');
    expect(app).toContain('FinishedSiteAds.applyAfterNavigationOffset(doc, node, navigation)');
    expect(adRestoration).toContain('hasAdjacentScrollProgressAfterNavigation(html)');
  });

  it('uses the normal-builder advertisement placeholders in finished-site previews without a second white banner card', () => {
    const previewSlots = app.slice(app.indexOf('function addAdInjectionPreviewSlots'), app.indexOf('function buildAdInjectionPreviewDocument'));

    expect(previewSlots).toContain("label.textContent = 'advertisement' + unitNumber;");
    expect(previewSlots).toContain("area.id = 'div-gpt-ad-banner' + unitNumber;");
    expect(previewSlots).toContain("area.style.cssText = 'min-width:300px;min-height:250px;';");
    expect(previewSlots).toContain("outer.style.cssText = 'text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;';");
    expect(previewSlots).not.toContain('Banner ');
    expect(previewSlots).not.toContain('300 × 250');
  });

  it('offers and previews the second detail banner at the semantic content midpoint', () => {
    const previewPipeline = app.slice(app.indexOf('function adInjectionPlacementLabel'), app.indexOf('function buildAdInjectionPreviewDocument'));

    expect(previewPipeline).toContain("'detail-after-content': '详情内容中部'");
    expect(previewPipeline).toContain('function adInjectionDetailContentTarget');
    expect(previewPipeline).toContain("['detail-after-content', content, 'middle', '正文中部']");
    expect(previewPipeline).toContain("slot.position === 'detail-after-content'");
    expect(previewPipeline).toContain('insertAdInjectionContentMiddle(content, node)');
    expect(previewPipeline).not.toContain("(slot.position === 'detail-after-content' || slot.position === 'content-bottom') && main) main.appendChild(node)");
  });

  it('turns every visible content gap into a custom finished-site placement target without reflowing the preview', () => {
    const previewPipeline = app.slice(app.indexOf('function adInjectionPlacementLabel'), app.indexOf('function buildAdInjectionPreviewDocument'));

    expect(previewPipeline).toContain('function collectAdInjectionCustomPlacements');
    expect(previewPipeline).toContain('var maxPlacements = 2400;');
    expect(previewPipeline).toContain('function rebuild(){geometries=[];');
    expect(previewPipeline).toContain('function fallbackAt(event)');
    expect(previewPipeline).toContain("document.addEventListener('mousemove',pointerMove,true)");
    expect(previewPipeline).toContain('function adInjectionResolveCustomTarget');
    expect(previewPipeline).toContain('function mountAdInjectionPlacementOverlay');
    expect(previewPipeline).toContain("overlay.id='sitefoundry-ad-placement-overlay'");
    expect(previewPipeline).toContain('position:fixed');
    expect(previewPipeline).toContain('requestAnimationFrame(render)');
    expect(previewPipeline).toContain("document.addEventListener('pointermove',pointerMove,true)");
    expect(previewPipeline).toContain("customLabel.textContent='＋ 点击放置广告'");
    expect(previewPipeline).toContain('customButton.hidden=true');
    expect(previewPipeline).toContain("type:'ad-injection-place'");
    expect(previewPipeline).toContain("/^custom-after-(?:\\d+)(?:-\\d+)*$/");
    expect(previewPipeline).toContain('insertAfter(adInjectionResolveCustomTarget(main, slot.position), node)');
    expect(previewPipeline).not.toContain('parentNode.insertBefore(marker');
    expect(app).toContain('上下内容之间的留白');
  });

  it('keeps common placement previews visible while only hiding the active custom placement', () => {
    const previewPipeline = app.slice(app.indexOf('function adInjectionPlacementLabel'), app.indexOf('function buildAdInjectionPreviewDocument'));
    const injectionMessages = app.slice(app.indexOf('function initAdInjectionConfig()'), app.indexOf('function renderAdInjectionResult'));

    expect(previewPipeline).toContain("candidate.kind==='common'");
    expect(previewPipeline).toContain('sitefoundry-injection-common-marker');
    expect(previewPipeline).toContain('sitefoundry-injection-custom-marker');
    expect(previewPipeline).toContain("node.textContent='＋ '+candidate.label");
    expect(previewPipeline).toContain("slot.unit === appState.adInjectionPlacementMode && /^custom-after-");
    expect(previewPipeline).toContain('adInjectionOccupiedPositions(page, appState.adInjectionPlacementMode)');
    expect(app).toContain('右侧仍显示常用广告位');
    expect(app).toContain('重新放置时仅隐藏当前自定义广告');
  });

  it('keeps removal page-scoped and tolerates detail pages without optional related content', () => {
    const placementMarkers = app.slice(app.indexOf('function addAdInjectionPlacementMarkers'), app.indexOf('function addAdInjectionPreviewNavigation'));
    const injectionMessages = app.slice(app.indexOf('function initAdInjectionConfig()'), app.indexOf('function renderAdInjectionResult'));

    expect(injectionMessages).toContain("setAdInjectionPolicyPlacement(unit, currentAdInjectionPreviewPage(), '');");
    expect(injectionMessages).not.toContain("setAdInjectionPolicyPlacement(unit, 'home', '');\n                setAdInjectionPolicyPlacement(unit, 'detail', '');");
    expect(placementMarkers).toContain("target && (candidate[2] === 'before' ? target.previousElementSibling : target.nextElementSibling)");
  });

  it('does not expose a custom placement trigger inside a visible common placement region', () => {
    const previewPipeline = app.slice(app.indexOf('function adInjectionPlacementLabel'), app.indexOf('function buildAdInjectionPreviewDocument'));

    expect(previewPipeline).toContain('function overlapsCommon(gap)');
    expect(previewPipeline).toContain("if(entry.candidate.kind!=='custom'||overlapsCommon(entry.gap))return;");
    expect(previewPipeline).toContain('if(overlapsCommon(fallbackGap))return;');
  });

  it('keeps a custom placement centered against the complete preview page, not its local content column', () => {
    const previewSlots = app.slice(app.indexOf('function addAdInjectionPreviewSlots'), app.indexOf('function buildAdInjectionPreviewDocument'));

    expect(app).toContain('function centerAdInjectionCustomPlacements');
    expect(previewSlots).toContain("outer.classList.add('sitefoundry-ad-custom-placement')");
    expect(previewSlots).toContain("--sitefoundry-ad-center-offset");
    expect(previewSlots).toContain('centerAdInjectionCustomPlacements(doc)');
  });
});
