/** Shared workbench accordions. Presentation state belongs to the controls,
 * never to website configuration, ZIP exports or advertising preferences. */
(function () {
  'use strict';
  function initialize() {
    const definitions = [
      ['template-grid','领域专属模板蓝图'], ['style-grid','配色主题'],
      ['layout-template-grid','页面布局模板'], ['diff-domain-blueprint-grid','领域专属模板蓝图'],
      ['diff-style-preset-grid','配色主题']
    ];
    definitions.forEach(function ([id, title]) {
      const grid = document.getElementById(id);
      if (!grid) return;
      const group = grid.closest(id === 'diff-style-preset-grid' ? '.config-item' : '.config-group');
      const heading = group?.querySelector('.group-title,.preset-heading');
      if (!heading || group.dataset.disclosureReady) return;
      group.dataset.disclosureReady = 'true';
      group.classList.add('config-disclosure');
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'config-disclosure-toggle';
      button.setAttribute('aria-expanded','false'); button.setAttribute('aria-controls', id + '-panel');
      const label = document.createElement('span'); label.className = 'config-disclosure-label'; label.textContent = title;
      const count = heading.querySelector('[id$="count"]') || group.querySelector('#diff-domain-blueprint-count') || document.createElement('span');
      count.classList.add('config-disclosure-count');
      const summary = document.createElement('span'); summary.className = 'config-disclosure-summary';
      const arrow = document.createElement('span'); arrow.className = 'config-disclosure-arrow'; arrow.textContent = '⌄'; arrow.setAttribute('aria-hidden','true');
      button.append(label,count,summary,arrow);
      heading.replaceChildren(button);
      const anchor = heading.closest('.diff-blueprint-heading') || heading;
      const panel = document.createElement('div'); panel.id = id + '-panel'; panel.className = 'config-disclosure-panel'; panel.hidden = true; panel.inert = true;
      const content = document.createElement('div'); content.className = 'config-disclosure-content'; panel.append(content);
      while(anchor.nextSibling) content.append(anchor.nextSibling);
      anchor.after(panel);
      let timer, frame;
      function setExpanded(expanded) {
        clearTimeout(timer); cancelAnimationFrame(frame);
        button.setAttribute('aria-expanded',String(expanded));
        panel.inert = !expanded;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        if(expanded) {
          panel.hidden = false;
          // Paint the closed grid before starting the opening transition.
          if(reduced) group.classList.add('is-expanded','is-settled');
          else frame = requestAnimationFrame(() => {frame=requestAnimationFrame(() => {
            group.classList.add('is-expanded');
            timer=setTimeout(()=>{if(button.getAttribute('aria-expanded')==='true')group.classList.add('is-settled');},260);
          });});
        } else {
          group.classList.remove('is-expanded','is-settled');
          if(reduced) panel.hidden=true;
          else timer=setTimeout(()=>{if(button.getAttribute('aria-expanded')==='false')panel.hidden=true;},260);
        }
      }
      button.addEventListener('click',()=>setExpanded(button.getAttribute('aria-expanded') !== 'true'));
      content.addEventListener('keydown',event=>{
        const card=event.target.closest('.style-card:not(button)');
        if(card && (event.key==='Enter'||event.key===' ')){event.preventDefault();card.click();}
      });
      let pending=false;
      function sync() {
        pending=false;
        const selected=grid.querySelector('.selected,.is-selected,[aria-selected="true"],[aria-pressed="true"]');
        const name=selected?.querySelector('.template-name,.style-name,.layout-template-name,.layout-template-title,strong');
        const value=(name?.textContent || selected?.textContent || '未选择').replace(/首选/g,'').trim();
        if(summary.textContent!==value)summary.textContent=value;
        const number=grid.children.length+' 套';
        if(count.textContent!==number)count.textContent=number;
        grid.querySelectorAll('.style-card:not(button)').forEach(card=>{
          if(!card.hasAttribute('tabindex'))card.tabIndex=0;
          if(!card.hasAttribute('role'))card.setAttribute('role','button');
          const selected=card.classList.contains('selected');
          if(card.getAttribute('aria-pressed')!==String(selected))card.setAttribute('aria-pressed',String(selected));
        });
      }
      // Grid renderers replace their contents when fields/templates change. One
      // coalesced observer keeps summaries current without wrapping app handlers.
      new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(sync);}}).observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-selected','aria-pressed']});
      sync();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
