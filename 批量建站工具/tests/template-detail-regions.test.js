import {describe,expect,it} from 'vitest';
import {DOMParser} from 'linkedom';
import {findDetailRegions,detailBodyHtml,replaceDetailBody} from '../js/template-detail-regions.js';
import {textEntry,entryText,parseContentJson,extractStaticSiteContent} from '../js/template-reuse-content.js';
import {inspectTemplate,reuseTemplateSite} from '../js/template-reuse.js';
import {templateListingCards,templateCardHref} from '../js/template-reuse-layout.js';
globalThis.DOMParser=DOMParser;
const parse=html=>new DOMParser().parseFromString(/<html\b/i.test(html) ? html : '<html><head><title>Old title</title></head><body>'+html+'</body></html>','text/html');
const ad=id=>`<div id="adv${id}"><div id="div-gpt-ad-banner${id}"></div></div>`;
const shell=html=>'<html><head><style>.unchanged{color:purple}</style></head><body><nav>Navigation</nav>'+html+'<footer>Legal</footer></body></html>';

describe('semantic article regions',()=>{
    it('keeps a heading inside a known article wrapper and prefers a separate inner body',()=>{
        const doc=parse('<article class="article-content"><h1>Heading</h1>'+ad(2)+'<div class="article-body"><p>Old prose</p></div></article>');
        const region=findDetailRegions(doc);expect(region.mode).toBe('container');expect(region.body.className).toBe('article-body');replaceDetailBody(region,'<p>New prose</p>');expect(doc.querySelector('h1').textContent).toBe('Heading');expect(doc.querySelector('#adv2')).not.toBeNull();
        const loose=parse('<article class="article-content"><h1>Heading</h1>'+ad(2)+'<p>Old prose</p></article>');
        const plan=findDetailRegions(loose);expect(plan.mode).toBe('blocks');replaceDetailBody(plan,'<p>New prose</p>');expect(loose.querySelector('h1').textContent).toBe('Heading');expect(loose.querySelector('#adv2').nextElementSibling.textContent).toBe('New prose');
    });
    it.each(['article','main','div role="article"'])('supports unclassified %s while preserving wrappers and advertisements',tag=>{
        const end=tag.split(' ')[0],doc=parse(`<${tag}><div class="unrelated-wrapper"><h1>Old title</h1><div class="publisher-source">Publisher</div>${ad(1)}<p class="prose">Old A</p>${ad(2)}<p class="prose">Old B</p><img src="cover.webp">${ad(3)}</div></${end}>`);
        const region=findDetailRegions(doc);expect(region.mode).toBe('blocks');expect(region.nodes).toHaveLength(2);
        const originals=[...doc.querySelectorAll('[id^="adv"]')].map(n=>n.outerHTML);
        expect(detailBodyHtml(region)).not.toMatch(/Publisher|advertisement|div-gpt|Old title/);
        replaceDetailBody(region,'<p>New A</p><h2>Section</h2><p>New C</p>');
        expect(doc.querySelector('h1').textContent).toBe('Old title');expect(doc.querySelector('.publisher-source').textContent).toBe('Publisher');
        expect([...doc.querySelectorAll('[id^="adv"]')].map(n=>n.outerHTML)).toEqual(originals);
        expect(doc.querySelector('#adv2').previousElementSibling.textContent).toBe('New A');
        expect(doc.querySelector('#adv3').previousElementSibling.tagName).toBe('IMG');
        expect(doc.querySelector('p').className).toBe('prose');expect(doc.querySelector('p p')).toBeNull();
        expect(doc.body.innerHTML).not.toMatch(/Old A|Old B/);
    });
    it('does not treat a multi-article index or header/navigation copy as detail prose',()=>{
        for(const html of ['<main><h1>Index</h1><article><h2>A</h2><p>A card</p></article></main>','<article><h1>Title</h1><header><p>Credit</p></header><aside><p>Related</p></aside></article>','<main><h1>A</h1><h1>B</h1><p>Unknown scope</p></main>'])expect(findDetailRegions(parse(html))).toBeNull();
    });
    it('replaces a summary-only paragraph with full valid blocks rather than truncating to the summary field',()=>{
        const source={entries:[textEntry('index.html',shell('<a href="details/item.html"><h3>Old title</h3></a>')),textEntry('details/item.html',shell('<article><div><h1>Old title</h1>'+ad(2)+'<p class="article-summary">Old body</p><img class="arbitrary-cover" src="old.png">'+ad(3)+'<a target="_blank" href="/old-source">Read source ↗</a></div></article><section class="related"><a class="related-card" href="item.html"><div class="x">Old related</div><div class="y">Old publisher</div></a></section>'))],metadata:{siteRoot:'',homePath:'index.html',detailPaths:['details/item.html'],listingPaths:[],adPath:'js/ad.js',detectedHost:'example.test'}};
        expect(inspectTemplate(source).details).toHaveLength(1);
        const items=parseContentJson([{title:'New title',content:'<p>FULL FIRST</p><p>FULL LAST</p>',summary:'SHORT',image:'https://example.test/new.png'}]);
        const result=reuseTemplateSite(source,{contentItems:items});const doc=parse(entryText(result.entries.find(e=>e.path==='details/item.html')));
        expect(doc.querySelector('article').textContent).toContain('FULL LAST');expect(doc.querySelector('article').textContent).not.toContain('SHORT');
        expect(doc.querySelector('h1').textContent).toBe('New title');expect(doc.querySelector('.arbitrary-cover').getAttribute('src')).toBe(items[0].image);
        expect(doc.querySelector('a[href="/old-source"]')).toBeNull();expect(doc.querySelector('.related-card')).toBeNull();
        expect(doc.querySelectorAll('p.article-summary')).toHaveLength(2);expect(doc.querySelector('p p')).toBeNull();
    });
    it('extracts semantic article content while excluding agreement pages and related metadata',()=>{
        const items=extractStaticSiteContent([textEntry('details/story.html',shell('<article><h1>Story</h1><div class="article-source">Old publisher</div>'+ad(1)+'<p>Full prose</p><img src="cover.png"></article><section class="related"><p>Related copy</p></section>')),textEntry('agreement.html',shell('<main><h1>Agreement</h1><p>Legal</p></main>'))]);
        expect(items).toHaveLength(1);expect(items[0].body).toContain('Full prose');expect(items[0].body).not.toMatch(/Old publisher|div-gpt|Related/);expect(items[0].image).toBe('cover.png');
    });
});

describe('literal hero navigation',()=>{
    it('reuses clickable hero covers without dropping or duplicating the first route',()=>{
        const source={entries:[textEntry('index.html',shell('<section class="hero" onclick="window.location.href=\'details/item-1.html\'" style="background-image:url(old.png);color:purple"><div class="video-meta">Old source</div><h3>Old one</h3></section><main><a class="unknown-row" href="details/item-2.html"><h3>Old two</h3></a></main>'+ad(2))),...[1,2].map(n=>textEntry('details/item-'+n+'.html',shell('<article><h1>Old '+n+'</h1><p>Old body</p></article>')))],metadata:{siteRoot:'',homePath:'index.html',detailPaths:['details/item-1.html','details/item-2.html'],adPath:'js/ad.js',detectedHost:'example.test'}};
        const result=reuseTemplateSite(source,{contentItems:parseContentJson([1,2,3].map(n=>({title:'New '+n,content:'Body '+n,image:'https://example.test/'+n+'.png',source:'New publisher'})))});
        const doc=parse(entryText(result.entries.find(e=>e.path==='index.html'))),cards=templateListingCards(doc,'index.html',result.metadata);
        expect(cards).toHaveLength(3);expect(cards.map(templateCardHref)).toEqual(result.metadata.detailPaths);
        expect(doc.querySelector('.hero h3').textContent).toBe('New 1');expect(doc.querySelector('.hero').style.getPropertyValue('background-image')).toContain('/1.png');
        expect(doc.querySelector('.hero').style.color).toBe('purple');expect(doc.querySelector('.video-meta').textContent).toBe('New publisher');
    });
    it('never interprets an arbitrary inline script as a navigation route',()=>{
        const doc=parse('<section onclick="alert(1);window.location.href=\'details/a.html\'"><h3>Unsafe</h3></section>');
        expect(templateListingCards(doc,'index.html',{detailPaths:['details/a.html'],siteRoot:''})).toHaveLength(0);
    });
});
