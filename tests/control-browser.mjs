/* Run with SAO_PLAYWRIGHT_MODULE pointing at an existing Playwright package
 * when it is not installed in this workspace. No dependency installation needed.
 * node --test tests/control*.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({chromium} = require(process.env.SAO_PLAYWRIGHT_MODULE || 'playwright')); }
catch { /* Pure lifecycle suite remains usable without browser tooling. */ }
const source = await readFile(new URL('../source/control-states.js', import.meta.url), 'utf8');

// Native rules below are the installed host's Pill / Switch / Menu contract.
// Tests use an isolated origin and fixture; they do not alter a running DSH tab.
const fixture = `<!doctype html><html><head><style>
:root{--dsw-alias-label-primary:#17212e;--dsw-alias-bg-base:#fff;--dsw-alias-brand-primary:#4080c0;--dsw-alias-label-on-brand:white;--dsw-alias-label-primary-foreground:white;--dsw-alias-switch-thumb:white;--dsw-focus-ring-width:2px;--dsw-focus-ring-color:#2377bb;color:#17212e;background:#fff}
html[data-test-dark]{--dsw-alias-label-primary:#ecf1f8;--dsw-alias-bg-base:#121823;--dsw-alias-brand-primary:#8cc8f4;--dsw-alias-label-on-brand:#111827;--dsw-alias-label-primary-foreground:#111827;--dsw-alias-switch-thumb:#ecf1f8;color:#ecf1f8;background:#121823}
body{padding:32px;font:14px system-ui}button,[role=option],[role=tab]{margin:5px;padding:8px;border-radius:8px;border:0;background:transparent;color:inherit}
._pill_rs966_1{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 8px;border:none;border-radius:999px;font-size:12px;line-height:18px;color:#677080;background:#e8eaf0}
._selectedFill_1p5el_245{background:#dfe7f4}
[data-sao-settings] button{background:#eef3f8;color:#28425a;border:1px solid #cad7e5;border-radius:12px;box-shadow:none}
._interactive_rs966_16{cursor:pointer}._active_rs966_26{color:#17212e;background:#d4dfed;box-shadow:inset 0 0 0 1px #4080c0}
._switch_1ik0f_5{box-sizing:border-box;position:relative;width:36px;height:20px;padding:2px;border:0;border-radius:999px;background:#aaa;cursor:pointer}
._switch_1ik0f_5[aria-checked=true]{background:var(--dsw-alias-brand-primary)}._switch_1ik0f_5:disabled{cursor:default;opacity:.5}
._thumb_1ik0f_33{display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground);transition:transform .12s ease}
._switch_1ik0f_5[aria-checked=false] ._thumb_1ik0f_33{background:var(--dsw-alias-switch-thumb)}._switch_1ik0f_5[aria-checked=true] ._thumb_1ik0f_33{transform:translate(16px)}
.danger,._danger_1p5el_250{color:rgb(190,20,30);background:rgb(255,230,230);box-shadow:inset 0 0 0 1px rgb(190,20,30)}
.disabled{background:rgb(199,199,199);color:rgb(110,110,110);opacity:.5}
[data-sao-material]{position:relative;width:200px;height:40px;--sao-optical-strength:.75}
[data-sao-material]::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:-1;border-radius:inherit;background:rgba(40,50,60,.4);backdrop-filter:blur(12px);box-shadow:inset 0 0 0 1px #777}
</style></head><body>
<button id="pill" class="_pill_rs966_1 _interactive_rs966_16">Native pill</button>
<button id="pillActive" class="_pill_rs966_1 _interactive_rs966_16 _active_rs966_26">Active pill</button>
<button id="pillFalse" aria-pressed="false" class="_pill_rs966_1 _interactive_rs966_16 _active_rs966_26">Stale class</button>
<button id="off" class="_switch_1ik0f_5" role="switch" aria-checked="false"><span class="_thumb_1ik0f_33"></span></button>
<button id="on" class="_switch_1ik0f_5" role="switch" aria-checked="true"><span class="_thumb_1ik0f_33"></span></button>
<button id="pressed" aria-pressed="true">Pinned</button><button id="notPressed" aria-pressed="false">Unpinned</button>
<button id="menu" role="menuitem" aria-current="page">Menu current</button>
<button id="menuClass" role="menuitem" class="_selectedFill_1p5el_245">Menu native selected</button>
<div role="menu"><button id="accountSettings" role="menuitem">Settings</button><button id="accountFeedback" role="menuitem">Feedback</button><button id="accountLogout" role="menuitem">Logout</button><button id="menuPressed" aria-pressed="true">Nested pressed action</button></div>
<button id="menuCheckbox" role="menuitemcheckbox" aria-checked="true">Native menu checkbox</button><button id="menuRadio" role="menuitemradio" aria-checked="true" data-state="checked">Native menu radio</button>
<section data-sao-settings><div role="tablist"><button id="settingsAppearance" role="tab" aria-selected="true">Appearance</button><button id="settingsWallpaper" role="tab" aria-selected="false">Wallpaper</button></div><button id="settingsSwitch" role="switch" aria-checked="true">Owned settings switch</button></section>
<div id="option" role="option" tabindex="0" aria-selected="true">Selected option</div>
<button id="tab" role="tab" aria-selected="false">Tab</button><button id="externalSelectedTab" role="tab" aria-selected="true" aria-pressed="true" data-state="on">Another plugin tab</button>
<button id="dataOn" data-on>On</button><button id="dataOff" data-off>Off</button>
<button id="dataSelected" data-state="selected">Selected</button><button id="dataUnchecked" data-state="unchecked">Unchecked</button>
<button id="danger" role="menuitem" class="_danger_1p5el_250">Delete</button>
<button id="dataDanger" role="menuitem" class="danger" data-variant="destructive">Delete</button>
<div data-danger><button id="ancestorDanger" class="danger" aria-pressed="true">Danger inside</button></div>
<button id="failed" class="danger" data-state="failed">Retry failed</button>
<button id="disabled" class="disabled" role="option" aria-selected="true" disabled>Disabled</button>
<div aria-disabled="true"><button id="ancestorDisabled" class="disabled" aria-pressed="true">Ancestor disabled</button></div>
<button id="ariaDisabled" class="disabled" role="menuitem" aria-disabled="true">Unavailable reason</button>
<fieldset disabled><button id="fieldsetDisabled" class="disabled" aria-pressed="true">Disabled group</button></fieldset>
<div inert><button id="inert" class="disabled" aria-pressed="true">Inert</button></div>
<div id="plain" data-state="selected">Plain stateful div</div><input id="input" type="checkbox">
<div id="glass" data-sao-material="frosted" data-sao-surface="floating">Glass</div>
<div id="joined" data-sao-material="frosted" data-sao-surface="joined">Joined glass</div>
</body></html>`;

const skip = chromium ? false : 'Set SAO_PLAYWRIGHT_MODULE to an existing Playwright package';
test('real browser: semantic and native states, safety exclusions, focus, glass and disposal', {skip}, async () => {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1100, height: 900}});
    await page.route('http://sao-controls.test/', route => route.fulfill({contentType: 'text/html', body: fixture}));
    await page.goto('http://sao-controls.test/');
    const style = (id, pseudo) => page.locator('#' + id).evaluate((el, ps) => {
      const c = getComputedStyle(el, ps);
      return {background: c.backgroundColor, color: c.color, shadow: c.boxShadow, outline: c.outlineStyle, outlineWidth: c.outlineWidth, opacity: c.opacity, filter: c.backdropFilter, width: c.width, height: c.height};
    }, pseudo);
    const protectedIds = ['danger','dataDanger','ancestorDanger','failed','disabled','ancestorDisabled','ariaDisabled','fieldsetDisabled','inert','plain'];
    const baseline = Object.fromEntries(await Promise.all(protectedIds.map(async id => [id, await style(id)])));
    const nativeIds=['tab','externalSelectedTab','menu','menuClass','accountSettings','accountFeedback','accountLogout','menuPressed','menuCheckbox','menuRadio','settingsAppearance','settingsWallpaper','settingsSwitch'];
    const nativeBaseline={};
    for(const dark of [false,true]){
      await page.evaluate(d=>document.documentElement.toggleAttribute('data-test-dark',d),dark);
      nativeBaseline[dark]=Object.fromEntries(await Promise.all(nativeIds.map(async id=>[id,await style(id)])));
    }
    await page.evaluate(()=>document.documentElement.removeAttribute('data-test-dark'));
    const glassBefore = await style('glass', '::before');
    const joinedBefore = await style('joined', '::before');
    await page.addScriptTag({content: source + `\nwindow.disposers=[];window.controls=applySAOControlStates({effect(fn){disposers.push(fn())}});`});
    for (const dark of [false, true]) {
      await page.evaluate(d => document.documentElement.toggleAttribute('data-test-dark', d), dark);
      const plain = await style('pill'), active = await style('pillActive');
      assert.notEqual(plain.background, active.background, 'native pill selected fill');
      assert.notEqual(plain.shadow, active.shadow, 'selected has a shape cue');
      assert.equal((await style('pillFalse')).background, plain.background, 'explicit false beats stale active class');
      assert.notEqual((await style('off')).background, (await style('on')).background, 'switch track on/off');
      assert.notEqual((await style('pressed')).background, (await style('notPressed')).background, 'pressed attribute');
      for(const id of nativeIds)assert.deepEqual(await style(id),nativeBaseline[dark][id],`${id}: native menus and SAO settings retain their own rendering`);
      for(const id of ['accountSettings','accountFeedback','accountLogout']){assert.equal((await style(id)).background,'rgba(0, 0, 0, 0)');assert.equal((await style(id)).shadow,'none')}
      assert.notEqual((await style('menuClass')).background,(await style('menu')).background,'native selected menu styling remains owned by host');
      assert.equal((await style('dataSelected')).background, (await style('option')).background, 'data-state and ARIA selection agree');
      assert.notEqual((await style('dataOn')).background, (await style('dataOff')).background, 'boolean on/off attributes');
      assert.equal((await style('dataUnchecked')).background, (await style('dataOff')).background, 'unchecked and off agree');
      await page.locator('#pill').hover();
      const hover = await style('pill');
      assert.notEqual(hover.background, plain.background, 'hover fill');
      await page.mouse.down();
      const down = await style('pill');
      assert.notEqual(down.background, hover.background, 'active press differs from hover');
      await page.mouse.up();
      await page.locator('#pillActive').hover();
      const selectedHover = await style('pillActive');
      assert.notEqual(selectedHover.background, active.background, 'selected hover remains distinct');
      await page.mouse.move(1090, 890);
      await page.locator('#externalSelectedTab').focus();
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const c=getComputedStyle(document.activeElement);return {outline:c.outlineStyle,width:c.outlineWidth};
      });
      assert.equal(focused.outline, 'solid');
      assert.equal(focused.width, '2px');
      await page.evaluate(() => document.activeElement.blur());
      for (const id of protectedIds) {
        const now = await style(id);
        if (id === 'plain') { assert.equal(now.background, baseline[id].background); assert.equal(now.shadow, baseline[id].shadow); }
        else assert.deepEqual(now, baseline[id], `${id}: danger/disabled rendering preserved`);
      }
    }
    // Composite translucent fills over the actual light/dark canvas before
    // measuring label contrast, including bright user-configured accents.
    const contrast = id => page.locator('#' + id).evaluate(el => {
      const c=getComputedStyle(el), root=getComputedStyle(document.documentElement);
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
      const x=canvas.getContext('2d');
      x.fillStyle=root.backgroundColor;x.fillRect(0,0,1,1);
      x.fillStyle=c.backgroundColor;x.fillRect(0,0,1,1);
      const bg=[...x.getImageData(0,0,1,1).data].slice(0,3);
      x.clearRect(0,0,1,1);x.fillStyle=c.color;x.fillRect(0,0,1,1);
      const fg=[...x.getImageData(0,0,1,1).data].slice(0,3);
      const lum=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
      const a=lum(bg),b=lum(fg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    });
    for (const dark of [false,true]) for (const accent of ['#4080c0','#f5a623','#ffffff']) {
      await page.evaluate(({dark,accent})=>{document.documentElement.toggleAttribute('data-test-dark',dark);document.documentElement.style.setProperty('--dsw-alias-brand-primary',accent)}, {dark,accent});
      await page.mouse.move(1090,890);
      assert.ok(await contrast('pillActive')>=4.5,`selected text contrast: ${dark}/${accent}`);
      await page.locator('#pillActive').hover();
      assert.ok(await contrast('pillActive')>=4.5,`selected hover text contrast: ${dark}/${accent}`);
      await page.mouse.down();
      assert.ok(await contrast('pillActive')>=4.5,`selected press text contrast: ${dark}/${accent}`);
      await page.mouse.up();
    }
    await page.mouse.move(1090,890);
    await page.evaluate(() => {document.documentElement.removeAttribute('data-test-dark');document.documentElement.style.removeProperty('--dsw-alias-brand-primary')});
    const glassAfter = await style('glass', '::before');
    assert.notEqual(glassAfter.shadow, glassBefore.shadow, 'glass edge depth added');
    for (const key of ['background','filter','width','height','opacity']) assert.equal(glassAfter[key], glassBefore[key], `glass ${key} preserved`);
    assert.deepEqual(await style('joined', '::before'), joinedBefore, 'joined glass seams preserved');
    assert.equal(await page.locator('style[data-sao-control-states]').count(), 1);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('dsh-sao-mode-change',{detail:{mode:'startup-only'}})));
    assert.equal(await page.locator('style[data-sao-control-states]').count(), 0);
    assert.equal(await page.locator('html').getAttribute('data-sao-controls'), null);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('dsh-sao-mode-change',{detail:{mode:'all'}})));
    await page.emulateMedia({forcedColors: 'active', reducedMotion: 'reduce'});
    const forced = await style('option');
    assert.equal(forced.outline, 'solid');
    assert.equal(forced.outlineWidth, '2px');
    await page.evaluate(() => window.disposers.forEach(fn => fn()));
    assert.equal(await page.locator('style[data-sao-control-states]').count(), 0);
    assert.equal(await page.locator('html').getAttribute('data-sao-controls'), null);
  } finally { await browser.close(); }
});

// ConversationRoot's stable DOM and layout contract, verified in the official
// ui-conversation bundle and authenticated GUI. The fixture contains no sessions.
const headerFixture = `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--dsw-alias-label-primary:#0f1115;--dsw-alias-label-tertiary:#82858a;--dsw-alias-bg-base:#f4f6f9;--dsw-alias-brand-primary:#8cc8f4;--dsw-alias-state-business-primary:#8cc8f4;--dsw-radius-md:8px;--dsw-radius-sm:6px;--dsw-focus-ring-width:2px}
html[data-test-dark]{--dsw-alias-label-primary:#f1f3f7;--dsw-alias-label-tertiary:#82858a;--dsw-alias-bg-base:#121823;color:#f1f3f7;background:#121823}
body{margin:0;padding:32px;font:14px system-ui}
/* Keep the unrelated tab fixture below the header; the simulated negative
   tab margin would otherwise paint across the last row of the pill screenshot. */
#unrelatedTabs{margin-top:48px}
[data-slot="conversation.header"]{display:contents}
/* Regression: another installed layer pads tabs beyond the native 25px row. */
[role=tab]{padding:10px 10px 9px!important;margin:-10px -10px 0!important}
header{box-sizing:border-box;display:grid;grid-template-columns:auto minmax(0,1fr);min-height:76px;padding:10px 28px 0 20px;width:760px;--sao-material-base:var(--dsw-alias-bg-base);--sao-surface-alpha:80%;--sao-optical-strength:.64}
.an3WzG_tabs{z-index:1;box-sizing:border-box;flex-wrap:wrap;grid-column:1/-1;align-items:flex-start;gap:16px 20px;width:100%;min-width:0;margin-top:10px;padding-left:8px;display:flex;position:relative}
.an3WzG_viewTabs{flex-wrap:wrap;gap:32px;min-width:0;min-height:25px;display:flex;height:14px;max-width:163px;flex:0 1 163px}
.an3WzG_tab{min-height:25px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:none;border:none;padding:0 0 9px;font:500 13px/16px system-ui;position:relative}
.an3WzG_tab::after{content:"";background:transparent;border-radius:2px;height:2px;position:absolute;bottom:-1px;left:0;right:0}
.an3WzG_tabActive{color:var(--dsw-alias-state-business-primary)}.an3WzG_tabActive::after{background:var(--dsw-alias-state-business-primary)}
.an3WzG_tabLabel{text-overflow:ellipsis;white-space:nowrap;max-width:88px;display:block;overflow:hidden}
</style></head><body><div data-slot="conversation.header"><header><div style="display:contents"><div style="min-height:30px;grid-column:2"></div><div class="an3WzG_tabs"><div id="topTabs" class="an3WzG_viewTabs" role="tablist" data-conversation-tabs>
${['对话','轨迹','上下文','编队','统计'].map((label,i)=>`<button id="view${i}" class="an3WzG_tab${i===0?' an3WzG_tabActive':''}" type="button" role="tab" aria-selected="${i===0}"><span class="an3WzG_tabLabel">${label}</span></button>`).join('')}
<button id="disabledTab" class="an3WzG_tab" type="button" role="tab" aria-selected="false" disabled><span class="an3WzG_tabLabel">Unavailable</span></button>
</div></div></div></header></div><div id="unrelatedTabs" data-conversation-tabs role="tablist"><button role="tab" aria-selected="true">Other headerless tabs</button></div></body></html>`;

test('conversation view row: compact pills, real header clearance, ARIA, states and startup-only restore', {skip}, async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1100,height:900}});
    await page.route('http://sao-header.test/', route=>route.fulfill({contentType:'text/html',body:headerFixture}));
    await page.goto('http://sao-header.test/');
    const snapshot=async()=>{await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().map(animation=>animation.finished))});return page.evaluate(()=>{
      const ids=['topTabs','view0','view1','view2','view3','view4','disabledTab','unrelatedTabs'];
      return Object.fromEntries(ids.map(id=>{
        const el=document.getElementById(id),r=el.getBoundingClientRect(),c=getComputedStyle(el),a=getComputedStyle(el,'::after');
        return [id,{geometry:{x:r.x,y:r.y,width:r.width,height:r.height,padding:c.padding,gap:c.gap,fontSize:c.fontSize,fontWeight:c.fontWeight,lineHeight:c.lineHeight},aria:{role:el.getAttribute('role'),selected:el.getAttribute('aria-selected'),disabled:el.hasAttribute('disabled'),tabindex:el.getAttribute('tabindex')},background:c.backgroundColor,color:c.color,shadow:c.boxShadow,outline:c.outlineStyle,outlineWidth:c.outlineWidth,underline:a.backgroundColor,underlineHeight:a.height,underlineDisplay:a.display,radius:c.borderRadius}];
      }));
    })};
    const baseline=await snapshot();
    await page.addScriptTag({content:source+'\nwindow.disposers=[];applySAOControlStates({effect(fn){disposers.push(fn())}});'});
    const all=await snapshot();
    for(const [id,initial] of Object.entries(baseline)){
      assert.equal(all[id].geometry.fontSize,initial.geometry.fontSize,`${id}: label font size preserved`);
      assert.equal(all[id].geometry.fontWeight,initial.geometry.fontWeight,`${id}: label weight preserved`);
      assert.deepEqual(all[id].aria,initial.aria,`${id}: no ARIA or keyboard attribute changes`);
    }
    const assertCompactLayout=async()=>{
      const result=await page.locator('#topTabs').evaluate(e=>{
        const tablist=e.getBoundingClientRect(),row=e.parentElement.getBoundingClientRect(),header=e.closest('header').getBoundingClientRect();
        return {gap:getComputedStyle(e).gap,padding:getComputedStyle(e).padding,wrap:getComputedStyle(e).flexWrap,radius:getComputedStyle(e).borderRadius,items:[...e.querySelectorAll('button[role="tab"]')].slice(0,5).map(b=>{
          const r=b.getBoundingClientRect(),c=getComputedStyle(b),label=b.firstElementChild;
          return {width:r.width,height:r.height,padding:c.padding,lineHeight:c.lineHeight,radius:c.borderRadius,inTablist:r.top>=tablist.top&&r.bottom<=tablist.bottom&&r.left>=tablist.left&&r.right<=tablist.right,inRow:r.top>=row.top&&r.bottom<=row.bottom,headerClearance:header.bottom-r.bottom,rowClearance:row.bottom-r.bottom,labelFits:label.scrollWidth<=label.clientWidth};
        })};
      });
      assert.equal(result.gap,'6px');assert.equal(result.padding,'3px');assert.equal(result.wrap,'nowrap');assert.equal(result.radius,'999px');
      for(const item of result.items){
        assert.equal(item.height,24,'24px compact pill');assert.ok(item.width<=70,'box follows short label');
        assert.equal(item.padding,'3px 9px');assert.equal(item.lineHeight,'18px');assert.equal(item.radius,'999px');
        assert.ok(item.inTablist&&item.inRow,'pill stays within both native containers');assert.ok(item.headerClearance>=6&&item.rowClearance>=6,'at least 6px to actual header and row edges');assert.ok(item.labelFits,'all five full labels remain visible');
      }
    };
    await assertCompactLayout();
    assert.equal(all.topTabs.background,'rgba(0, 0, 0, 0)','header glass shows through the whole tablist');
    assert.equal(all.topTabs.shadow,'none','no second enclosing highlight or grey backing');
    assert.equal(all.unrelatedTabs.background,baseline.unrelatedTabs.background,'headerless tablist has no special backing');
    assert.equal(all.unrelatedTabs.shadow,baseline.unrelatedTabs.shadow,'headerless tablist has no special border');
    for(const key of ['color','background','shadow'])assert.equal(all.disabledTab[key],baseline.disabledTab[key],`disabled tab ${key} untouched`);
    assert.notEqual(all.view0.background,all.view1.background,'selected tab fill');
    assert.notEqual(all.view0.shadow,all.view1.shadow,'selected uses a single light concentric edge');
    const assertLightStroke=async()=>{
      const values=await page.locator('#topTabs').evaluate(e=>{
        const active=e.querySelector('[aria-selected="true"]'),inactive=e.querySelector('[aria-selected="false"]:not(:disabled)');
        const s=getComputedStyle(active),c=document.createElement('canvas'),x=c.getContext('2d');
        const alpha=color=>{x.clearRect(0,0,1,1);x.fillStyle=color;x.fillRect(0,0,1,1);return x.getImageData(0,0,1,1).data[3]/255};
        const border=['Top','Right','Bottom','Left'].map(side=>s['border'+side+'Width']);
        return{selectedAlpha:alpha(s.backgroundColor),restAlpha:alpha(getComputedStyle(inactive).backgroundColor),strokeAlpha:alpha(s.getPropertyValue('--sao-view-stroke')),shadow:s.boxShadow,border,image:s.backgroundImage};
      });
      assert.ok(values.selectedAlpha<=.14,'selected fill remains at most 14% opaque');assert.ok(values.restAlpha<=.02,'inactive fill at most 2% opaque');
      assert.ok(values.strokeAlpha<=.15,'no dark opaque selected ring');assert.equal(values.image,'none');
      assert.deepEqual(values.border,['0px','0px','0px','0px'],'no border stacked below the inset ring');
      assert.match(values.shadow,/0px 0px 0px 1px inset$/,'one zero-offset one-pixel inset stroke');
      assert.doesNotMatch(values.shadow,/inset.*inset|inset.*-2px/,'no directional bottom strip or doubled edge');
    };
    assert.equal(all.view0.underlineDisplay,'none','native underline does not protrude below pill');
    assert.equal(all.view1.underline,'rgba(0, 0, 0, 0)','unselected underline clear');
    assert.notEqual(all.view1.color,baseline.view1.color,'inactive labels use legible primary ink');
    for(const dark of [false,true]){
      await page.evaluate(d=>document.documentElement.toggleAttribute('data-test-dark',d),dark);
      await assertCompactLayout();
      await page.mouse.move(1090,890);
      const normal=await snapshot(); await assertLightStroke();
      await page.locator('#view0').hover(); await snapshot();
      assert.equal((await snapshot()).view0.shadow,normal.view0.shadow,'hover preserves exactly the same even stroke');
      await page.mouse.down(); await snapshot();
      assert.equal((await snapshot()).view0.shadow,normal.view0.shadow,'press preserves exactly the same even stroke');
      await page.mouse.up(); await page.mouse.move(1090,890); await snapshot();
      await page.locator('#view1').hover();const hovered=await snapshot();
      assert.notEqual(hovered.view1.background,normal.view1.background,'top tab hover fill');
      await page.mouse.down();const pressed=await snapshot();
      assert.notEqual(pressed.view1.background,hovered.view1.background,'top tab pressed fill');
      await page.mouse.up();await page.mouse.move(1090,890);
      await page.locator('#view0').focus();await page.keyboard.press('Tab');
      const focused=await snapshot();assert.equal(focused.view1.outline,'solid');assert.equal(focused.view1.outlineWidth,'2px');
      await page.evaluate(()=>document.activeElement.blur());
    }
    // Host updates selection; the stylesheet must follow ARIA without any DOM
    // observation, and must clear even a stale native tabActive underline.
    await page.evaluate(()=>{document.getElementById('view0').setAttribute('aria-selected','false');document.getElementById('view2').setAttribute('aria-selected','true')});
    const changed=await snapshot();assert.equal(changed.view0.underlineDisplay,'none');assert.equal(changed.view2.underlineDisplay,'none');assert.notEqual(changed.view2.shadow,changed.view0.shadow,'inset selection follows ARIA');
    await page.evaluate(()=>{document.documentElement.removeAttribute('data-test-dark');document.getElementById('view0').setAttribute('aria-selected','true');document.getElementById('view2').setAttribute('aria-selected','false');window.dispatchEvent(new CustomEvent('dsh-sao-mode-change',{detail:{mode:'startup-only'}}))});
    assert.deepEqual(await snapshot(),baseline,'startup-only exactly restores host row styles, geometry and semantics');
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('dsh-sao-mode-change',{detail:{mode:'all'}})));
    assert.deepEqual(await snapshot(),all,'returning to all restores top-row styling once');
    await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});
    const forced=await snapshot();assert.equal(forced.topTabs.shadow,'none');assert.equal(forced.view0.outline,'solid');
    await page.emulateMedia({forcedColors:'none'});
    await page.evaluate(()=>window.disposers.forEach(fn=>fn()));
    assert.deepEqual(await snapshot(),baseline,'plugin disposal restores original row');
  }finally{await browser.close()}
});
