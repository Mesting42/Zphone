import { analyzeTemplate, prepareTemplate } from './ad-template-analysis.js';
import { initializeNativeWorkbench } from './native-workbench.js';

// Keep parser semantics shared with the Node template API. This module is a
// separate Vite entry because the game workbench still uses classic scripts.
const platform = window.SiteFoundryPlatform;
if (platform) {
    platform.registerTemplateAnalysis({ analyzeTemplate, prepareTemplate });
    const start = () => initializeNativeWorkbench(platform);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
}
