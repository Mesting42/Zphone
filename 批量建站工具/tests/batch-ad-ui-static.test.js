import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const builder = readFileSync(new URL('../js/batch-ad-builder.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/tool.css', import.meta.url), 'utf8');

describe('batch ad upload formats', () => {
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
    expect(app).toContain('applyAdCodeBatch(appState.adInjectionSites, appState.adInjectionCodes');
    expect(app).toContain('getAdInjectionPolicy(), injectReactSource);');
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
    expect(html).toContain('操作方式与普通建站一致');
    expect(css).toContain('.injection-ad-select-btn.is-active');
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

  it('keeps local static and compiled framework scripts executable in the isolated preview', () => {
    const previewPipeline = app.slice(app.indexOf('function resolveAdInjectionPreviewAsset'), app.indexOf('function currentAdInjectionPreviewPage'));

    expect(previewPipeline).toContain('function rewriteAdInjectionPreviewModule');
    expect(previewPipeline).toContain("script-src 'unsafe-inline' data:");
    expect(previewPipeline).toContain("doc.querySelectorAll('script[src]')");
    expect(previewPipeline).toContain("node.setAttribute('src', assetUrls[resolved.toLowerCase()])");
    expect(previewPipeline).not.toContain("doc.querySelectorAll('script, link[rel=\"modulepreload\"], link[rel=\"preload\"][as=\"script\"]')");
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
    expect(previewPipeline).not.toContain("var link=event.target.closest('a');if(link)event.preventDefault()");
    expect(injectionMessages).toContain("event.data.type === 'ad-injection-preview-navigate'");
    expect(injectionMessages).toContain('resolvePreviewHtmlEntry');
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
    expect(previewPipeline).toContain("customButton.textContent='＋ 点击放置广告'");
    expect(previewPipeline).toContain('customButton.hidden=true');
    expect(previewPipeline).toContain("type:'ad-injection-place'");
    expect(previewPipeline).toContain("/^custom-after-(?:\\d+)(?:-\\d+)*$/");
    expect(previewPipeline).toContain('insertAfter(adInjectionResolveCustomTarget(main, slot.position), node)');
    expect(previewPipeline).not.toContain('parentNode.insertBefore(marker');
    expect(app).toContain('也可将鼠标移动到内容空隙');
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
    expect(app).toContain('右侧会直接显示常用广告位');
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
