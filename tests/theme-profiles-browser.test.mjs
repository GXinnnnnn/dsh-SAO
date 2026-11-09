// Focused actual-source browser checks for independent light/dark accent memory,
// migration, native-service races and avoiding unrelated material passes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createRequire} from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
let chromium, dependencyError;
try { ({chromium} = require(process.env.SAO_TEST_PLAYWRIGHT ?? 'C:/DSH/graduation-office/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright')); }
catch (error) { dependencyError = error.message; }
const source = ['better-sidebar.js','liquid-glass.js','video-wallpaper.js','settings-panel.js','appearance.js'].map(name => fs.readFileSync(new URL('../source/' + name, import.meta.url),'utf8')).join('\n');
const html = `<!doctype html><meta charset="utf-8"><style>
body{--dsw-alias-brand-primary:#123456;--dsw-alias-bg-base:#eeeeee;font-family:Arial}
#frame{display:flex;width:940px;height:600px;position:relative}#column{width:680px;height:600px}#right{width:260px;height:600px}header{height:48px}
</style><div id="frame"><div id="column"><div data-slot="conversation.header"><header>Conversation</header></div><div data-slot="main.conversation"></div><div id="scene-scroll" style="height:100px;overflow:auto"><div style="height:600px"></div></div></div><div id="right"><div data-slot="rightbar"></div></div></div>
<div role="dialog" data-shortcut-modal="settings"><div id="settings-scroll" style="height:100px;overflow:auto"><div id="settings"></div><div style="height:600px"></div></div></div>`;
function fixture() {
  const KEY = 'dsh-sao.preferences.v4', listeners = new Set(), cleanups = [];
  let preference = 'light', effective = 'light', panelCleanup = null;
  window.calls = []; window.nativeTransitions = 0; window.serviceError = false;
  if (document.startViewTransition) { const original = document.startViewTransition.bind(document); document.startViewTransition = (...args) => { nativeTransitions++; return original(...args); }; }
  const effect = fn => { const cleanup = fn(); if (typeof cleanup === 'function') cleanups.push(cleanup); };
  const inspect = {register(definition) { window.inspector = definition; return () => {}; }};
  window.ctx = {
    theme: {
      getTheme: () => ({preference,effective}),
      setTheme(mode) { calls.push(mode); if (serviceError) throw Error('Native theme service failed'); preference = mode; effective = mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode; document.body.toggleAttribute('data-ds-dark-theme', effective === 'dark'); for (const fn of listeners) fn(); }
    }, effect, get: () => ({}),
    on(name, fn) { if (name === 'theme/change') { listeners.add(fn); cleanups.push(() => listeners.delete(fn)); } },
    slots:{inject:()=>{},register:()=>{}}, inject(dependencies, fn) { fn({effect,get:()=>inspect}); }
  };
  window.stop = () => { panelCleanup?.(); panelCleanup = null; for (const cleanup of cleanups.splice(0).reverse()) cleanup(); };
  window.start = (saved = {}, native = {preference:'light',effective:'light'}) => {
    stop(); preference = native.preference; effective = native.effective; calls.length = 0;
    localStorage.setItem(KEY,JSON.stringify({wallpaper:'none',surfaceColor:null,fontFamily:'Arial',...saved}));
    window.api = applySAOAppearance(ctx,{},[]);
    panelCleanup = mountSAOSettings(document.querySelector('#settings'),api);
  };
  window.externalTheme = (mode, resolved) => { preference = mode; effective = resolved; document.body.toggleAttribute('data-ds-dark-theme', resolved === 'dark'); for (const fn of listeners) fn(); };
  window.receive = saved => {
    const oldValue = localStorage.getItem(KEY), newValue = JSON.stringify(saved);
    localStorage.setItem(KEY,newValue);
    dispatchEvent(new StorageEvent('storage',{key:KEY,oldValue,newValue,storageArea:localStorage,url:location.href}));
  };
  window.paint = async () => { for (let i=0;i<4;i++) await new Promise(requestAnimationFrame); };
  window.state = () => ({...api.get(), cssAccent:getComputedStyle(document.body).getPropertyValue('--dsw-alias-brand-primary').trim(),passes:inspector.query('snapshot').passes,error:inspector.query('snapshot').error,paletteStyles:document.querySelectorAll('style[data-sao-palette]').length,stored:JSON.parse(localStorage.getItem(KEY))});
}

test('light/dark accent profiles use native theme state without full-screen transitions', {skip:dependencyError ? `optional browser dependency unavailable: ${dependencyError}` : false,timeout:60000}, async t => {
  const server = http.createServer((request,response) => { response.setHeader('Content-Type','text/html; charset=utf-8'); response.end(html); });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({channel:'msedge',headless:true}); t.after(() => browser.close());
  async function pageFor(t, saved = {}, native) {
    const context = await browser.newContext({viewport:{width:1100,height:900},colorScheme:'light'});
    const page = await context.newPage(), errors=[];
    page.on('pageerror',error => errors.push(error.message));
    page.on('console',message => { if (message.type()==='error') errors.push(message.text()); });
    t.after(async()=>{try{await page.evaluate(()=>stop());assert.deepEqual(errors,[]);}finally{await context.close();}});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.addScriptTag({content:source+'\n('+fixture.toString()+')();'});
    await page.evaluate(({saved,native})=>start(saved,native),{saved,native});
    await page.evaluate(()=>paint()); return page;
  }
  await t.test('legacy global colors and explicit follow-DSH migrate to both profiles without an initialization write',async t=>{
    const page=await pageFor(t);
    for(const accent of ['#aBcDef',null]){
      const result=await page.evaluate(async accent=>{start({accent});await paint();return state();},accent);
      const expected=accent===null?null:'#ABCDEF';assert.deepEqual(result.accentProfiles,{light:expected,dark:expected});assert.equal(result.accent,expected);
      assert.equal(Object.hasOwn(result.stored,'accentProfiles'),false,'migration stays in memory until the next user save');
      assert.equal(result.cssAccent,expected||'#123456');
    }
  });
  await t.test('light sky-blue and dark deep-blue selections restore independently through reload and cloned snapshots',async t=>{
    const page=await pageFor(t);
    const result=await page.evaluate(async()=>{
      api.set({accent:'#8cc8f4'});await api.setTheme('dark');api.set({accent:'#185fa5'});await paint();const dark=state();
      const snapshot=api.get();snapshot.accentProfiles.dark='#FFFFFF';const cloned=api.get().accentProfiles.dark;
      await api.setTheme('light');const light=state();await api.setTheme('dark');const returned=state();
      start(returned.stored,{preference:'dark',effective:'dark'});await paint();return{dark,light,returned,reloaded:state(),cloned,transitions:nativeTransitions};
    });
    assert.equal(result.dark.accent,'#185FA5');assert.equal(result.light.accent,'#8CC8F4');assert.equal(result.returned.accent,'#185FA5');assert.equal(result.reloaded.accent,'#185FA5');assert.equal(result.cloned,'#185FA5');
    assert.deepEqual(result.returned.accentProfiles,{light:'#8CC8F4',dark:'#185FA5'});assert.equal(result.transitions,0);
  });
  await t.test('invalid/partial profiles normalize without sharing mutable defaults or accepting prototype values',async t=>{
    const page=await pageFor(t,{accent:'#FF0000',accentProfiles:{light:'invalid',dark:'#185fa5',extra:'#FFFFFF'}});
    const result=await page.evaluate(async()=>{const first=state();start({accentProfiles:{light:null,dark:23}});await paint();return{first,second:state(),defaultClone:api.getDefault('accentProfiles')};});
    assert.deepEqual(result.first.accentProfiles,{light:'#8CC8F4',dark:'#185FA5'});assert.deepEqual(result.second.accentProfiles,{light:null,dark:'#8CC8F4'});assert.deepEqual(result.defaultClone,{light:'#8CC8F4',dark:'#8CC8F4'});
  });
  await t.test('system uses native resolved mode even when OS differs and external theme events restore the right profile',async t=>{
    const page=await pageFor(t,{theme:'system',accentProfiles:{light:'#8CC8F4',dark:'#185FA5'}},{preference:'system',effective:'dark'});
    assert.equal(await page.evaluate(()=>state().accent),'#185FA5');
    const result=await page.evaluate(async()=>{externalTheme('system','light');await paint();const light=state();externalTheme('system','dark');await paint();return{light,dark:state()};});
    assert.equal(result.light.accent,'#8CC8F4');assert.equal(result.dark.accent,'#185FA5');assert.equal(result.dark.theme,'system');
  });
  await t.test('OS events select profiles in system mode when the native service exposes preference only',async t=>{
    const page=await pageFor(t,{theme:'system',accentProfiles:{light:'#8CC8F4',dark:'#185FA5'}},{preference:'system',effective:'light'});
    await page.evaluate(()=>{ctx.theme.getTheme=()=>({preference:'system'});});
    await page.emulateMedia({colorScheme:'dark'});await page.evaluate(()=>paint());assert.equal(await page.evaluate(()=>state().accent),'#185FA5');
    await page.emulateMedia({colorScheme:'light'});await page.evaluate(()=>paint());assert.equal(await page.evaluate(()=>state().accent),'#8CC8F4');
  });
  await t.test('native DOM marker resolves system dark mode without layout-dependent color probing',async t=>{
    const page=await pageFor(t,{theme:'system',accentProfiles:{light:'#8CC8F4',dark:'#185FA5'}},{preference:'system',effective:'light'});
    const result=await page.evaluate(async()=>{ctx.theme.getTheme=()=>({preference:'system'});externalTheme('system','dark');await paint();return state();});
    assert.equal(result.accent,'#185FA5');assert.equal(result.theme,'system');
  });
  await t.test('null follows DSH per mode; resetting one accent preserves the other and global reset resets both',async t=>{
    const page=await pageFor(t,{accentProfiles:{light:'#8CC8F4',dark:'#185FA5'}});
    const result=await page.evaluate(async()=>{
      await api.setTheme('dark');api.set({accent:null});const follow=state();await api.setTheme('light');api.set({accent:'#D89D2B'});await api.resetSetting('accent');const resetLight=state();await api.setTheme('dark');const restoredNull=state();
      await api.reset();await paint();return{follow,resetLight,restoredNull,global:state()};
    });
    assert.equal(result.follow.accent,null);assert.equal(result.follow.cssAccent,'#123456');assert.deepEqual(result.resetLight.accentProfiles,{light:'#8CC8F4',dark:null});assert.equal(result.restoredNull.accent,null);assert.deepEqual(result.global.accentProfiles,{light:'#8CC8F4',dark:'#8CC8F4'});
  });
  await t.test('cross-window profile writes use local effective mode, normalize and avoid irrelevant material passes',async t=>{
    const page=await pageFor(t);
    const result=await page.evaluate(async()=>{const before=state();receive({...api.get(),theme:'dark',accent:'#185FA5',accentProfiles:{light:'#D89D2B',dark:'#185FA5'}});await paint();const remote=state();externalTheme('dark','dark');await paint();const dark=state();receive({accent:null});await paint();return{before,remote,dark,legacy:state()};});
    assert.equal(result.remote.theme,'light');assert.equal(result.remote.accent,'#D89D2B');assert.equal(result.remote.passes,result.before.passes);assert.equal(result.dark.accent,'#185FA5');assert.deepEqual(result.legacy.accentProfiles,{light:null,dark:null});
  });
  await t.test('real same-origin tab storage events synchronize profiles without writing back or replacing local theme mode',async t=>{
    const page=await pageFor(t,{accentProfiles:{light:'#8CC8F4',dark:'#185FA5'}});
    const writer=await page.context().newPage();t.after(()=>writer.close());await writer.goto(page.url());
    const before=await page.evaluate(()=>state().passes);
    await writer.evaluate(()=>localStorage.setItem('dsh-sao.preferences.v4',JSON.stringify({wallpaper:'none',surfaceColor:null,fontFamily:'Arial',theme:'dark',accent:'#185FA5',accentProfiles:{light:'#D89D2B',dark:'#185FA5'}})));
    await page.waitForFunction(()=>api.get().accent==='#D89D2B');await page.evaluate(()=>paint());
    const result=await page.evaluate(()=>state());assert.equal(result.theme,'light');assert.equal(result.passes,before);assert.deepEqual(result.accentProfiles,{light:'#D89D2B',dark:'#185FA5'});
    const remote=await writer.evaluate(()=>JSON.parse(localStorage.getItem('dsh-sao.preferences.v4')));assert.equal(remote.theme,'dark','receiver never writes a theme ping-pong into storage');
  });
  await t.test('accent-only updates preserve material CSS and geometry; base-color and native mode changes still synchronize',async t=>{
    const page=await pageFor(t);
    const result=await page.evaluate(async()=>{
      const material=document.querySelector('style[data-sao-appearance]'),before=state(),text=material.textContent;
      let writes=0;const observer=new MutationObserver(records=>{writes+=records.length;});observer.observe(material,{subtree:true,childList:true,characterData:true});
      for(const accent of ['#D89D2B','#185FA5','#8CC8F4']){api.set({accent});await paint();}const accent=state(),sameText=text===material.textContent;observer.disconnect();
      api.set({surfaceColor:'#ABCDEF'});await paint();const surface=state();await api.setTheme('dark');await paint();const theme=state();return{before,accent,surface,theme,writes,sameText,transitions:nativeTransitions};
    });
    assert.equal(result.accent.passes,result.before.passes);assert.equal(result.writes,0);assert.equal(result.sameText,true);assert.ok(result.surface.passes>result.accent.passes);assert.equal(result.theme.passes-result.surface.passes,1);assert.equal(result.transitions,0);assert.equal(result.theme.error,null);
  });
  await t.test('settings-local scroll skips scene passes while real conversation scroll keeps masks synchronized',async t=>{
    const page=await pageFor(t);
    const result=await page.evaluate(async()=>{const before=state().passes;document.querySelector('#settings-scroll').scrollTop=80;await paint();const settings=state().passes;document.querySelector('#scene-scroll').scrollTop=80;await paint();return{before,settings,scene:state().passes};});
    assert.equal(result.settings,result.before);assert.ok(result.scene>result.settings);
  });
  await t.test('startup-only follows host palette without applying profiles; reenable uses current native mode',async t=>{
    const page=await pageFor(t,{featureMode:'startup-only',accentProfiles:{light:'#8CC8F4',dark:'#185FA5'}});
    const result=await page.evaluate(async()=>{externalTheme('dark','dark');await api.setTheme('light');const suspended=state();api.set({featureMode:'all'});await paint();return{suspended,active:state(),calls:[...calls]};});
    assert.equal(result.suspended.cssAccent,'#123456');assert.equal(result.suspended.paletteStyles,0);assert.deepEqual(result.calls,[]);assert.equal(result.active.accent,'#185FA5');assert.equal(result.active.cssAccent,'#185FA5');
  });
  await t.test('newer queued native theme selection cancels global reset without losing either saved profile',async t=>{
    const page=await pageFor(t,{fontFamily:'Custom',accentProfiles:{light:'#D89D2B',dark:'#185FA5'}});
    const result=await page.evaluate(async()=>{const reset=api.reset(),theme=api.setTheme('dark');await Promise.all([reset,theme]);await paint();return state();});
    assert.equal(result.theme,'dark');assert.equal(result.fontFamily,'Custom');assert.deepEqual(result.accentProfiles,{light:'#D89D2B',dark:'#185FA5'});
  });
  await t.test('asynchronous native service failure propagates and disposal cancels a queued request before service invocation',async t=>{
    const page=await pageFor(t);
    const result=await page.evaluate(async()=>{ctx.theme.setTheme=async()=>{throw Error('Async native theme failure');};const before=localStorage.getItem('dsh-sao.preferences.v4');let error;try{await api.setTheme('dark');}catch(failure){error=failure.message;}const after=localStorage.getItem('dsh-sao.preferences.v4');let invoked=0;ctx.theme.setTheme=()=>{invoked++;};const task=api.setTheme('dark');window[Symbol.for('dsh.sao.appearance.v4')].dispose();await task;return{before,after,error,invoked};});
    assert.equal(result.error,'Async native theme failure');assert.equal(result.before,result.after);assert.equal(result.invoked,0);
  });
  await t.test('native service errors reject without saving a false palette and newer queued requests win',async t=>{
    const page=await pageFor(t,{accentProfiles:{light:'#8CC8F4',dark:'#185FA5'}});
    const result=await page.evaluate(async()=>{
      const before=localStorage.getItem('dsh-sao.preferences.v4');serviceError=true;let error;try{await api.setTheme('dark');}catch(failure){error=failure.message;}const after=localStorage.getItem('dsh-sao.preferences.v4');serviceError=false;
      calls.length=0;await Promise.all([api.setTheme('dark'),api.setTheme('system')]);await paint();return{before,after,error,calls:[...calls],current:state(),transitions:nativeTransitions};
    });
    assert.equal(result.error,'Native theme service failed');assert.equal(result.before,result.after);assert.deepEqual(result.calls,['system']);assert.equal(result.current.theme,'system');assert.equal(result.current.accent,'#8CC8F4');assert.equal(result.transitions,0);
  });
});
