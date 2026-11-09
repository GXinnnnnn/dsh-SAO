import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Execute the actual preference helpers and API. No DOM, mock page or renderer.
const source=readFileSync(new URL('../source/appearance.js',import.meta.url),'utf8');
const start=source.indexOf('  const defaults = '),end=source.indexOf('  let preferences;');
const apiStart=source.indexOf('  const api = {'),apiEnd=source.indexOf('    setTheme: changeTheme,',apiStart);
const reset=source.match(/^    async reset\(\) \{[^\n]+\}/m)?.[0];
assert.ok(start>=0&&end>start&&apiStart>end&&apiEnd>apiStart&&reset);
const factory=new Function('builtins','initial',`
${source.slice(start,end)}
let preferences=normalize(initial),disposed=false,notice='',revision=0,saves=0;
const announceMode=()=>{},applyTokens=()=>{},persist=()=>{saves++;},schedule=()=>{},sync=()=>{};
const readThemePreference=()=>preferences.theme,changeTheme=async()=>{};
${source.slice(apiStart,apiEnd)}
${reset}
};
return {api,normalize,windowSurfaceOpacity,stats:()=>({saves})};
`);
const model=initial=>factory([],initial||{});

test('liquid header starts at 20% transparency while frosted and original retain their defaults',()=>{
  const {api}=model();
  assert.equal(api.get().headerOpacity,.80);
  assert.equal(api.getDefault('headerOpacity'),.80);
  for(const glass of ['frosted','off']){
    api.set({glass});assert.equal(api.get().headerOpacity,.40);assert.equal(api.getDefault('headerOpacity'),.40);
  }
  api.set({glass:'liquid'});assert.equal(api.get().headerOpacity,.80);
});

test('former untouched header default migrates to liquid 20% without touching independent right header',()=>{
  for(const glass of ['liquid','frosted']){
    const {api}=model({glass,headerOpacity:.40,headerLinked:false,rightHeaderOpacity:.18});
    assert.equal(api.get().headerOpacity,glass==='liquid'?.80:.40);
    assert.equal(api.get().rightHeaderOpacity,.18);
    assert.deepEqual(api.get().headerSceneProfiles,{});
    api.set({glass:'liquid'});assert.equal(api.get().headerOpacity,.80);
  }
});

test('legacy custom header including transparent and opaque endpoints survives reload',()=>{
  for(const headerOpacity of [0,.27,.72,1]){
    const {api}=model({headerOpacity});assert.equal(api.get().headerOpacity,headerOpacity);
    const reload=model(JSON.parse(JSON.stringify(api.get()))).api;
    assert.equal(reload.get().headerOpacity,headerOpacity);
    reload.set({glass:'frosted'});assert.equal(reload.get().headerOpacity,.40);
    reload.set({glass:'liquid'});assert.equal(reload.get().headerOpacity,headerOpacity);
  }
});

test('each header material retains its own edit including a new explicit old .40 value',()=>{
  const {api}=model();
  for(const [glass,headerOpacity] of [['liquid',.40],['frosted',.22],['off',.13]]) api.set({glass,headerOpacity});
  const reload=model(JSON.parse(JSON.stringify(api.get()))).api;
  for(const [glass,alpha] of [['liquid',.40],['frosted',.22],['off',.13]]){reload.set({glass});assert.equal(reload.get().headerOpacity,alpha);}
});

test('header field reset restores current material without erasing other material edits',()=>{
  const {api}=model();api.set({headerOpacity:.2});api.set({glass:'frosted',headerOpacity:.3});
  api.resetSetting('headerOpacity');assert.equal(api.get().headerOpacity,.40);
  api.set({glass:'liquid'});assert.equal(api.get().headerOpacity,.2);
  api.resetSetting('headerOpacity');assert.equal(api.get().headerOpacity,.80);
  assert.deepEqual(api.get().headerSceneProfiles,{});
});

test('full reset clears header profiles and returns to liquid 20%',async()=>{
  const {api}=model();api.set({headerOpacity:.1});api.set({glass:'frosted',headerOpacity:.2});await api.reset();
  assert.equal(api.get().glass,'liquid');assert.equal(api.get().headerOpacity,.80);assert.deepEqual(api.get().headerSceneProfiles,{});
});

test('combined material switch and header unlink copies the newly selected header',()=>{
  const {api}=model();api.set({glass:'frosted',headerLinked:false});
  assert.equal(api.get().headerOpacity,.40);assert.equal(api.get().rightHeaderOpacity,.40);
  api.set({headerLinked:true});api.set({glass:'liquid',headerOpacity:.61,headerLinked:false});
  assert.equal(api.get().headerOpacity,.61);assert.equal(api.get().rightHeaderOpacity,.61);
  api.set({headerLinked:true});api.set({glass:'frosted',headerLinked:false,rightHeaderOpacity:.11});
  assert.equal(api.get().rightHeaderOpacity,.11);
});

test('header profile get is detached and repeated edits do not save again',()=>{
  const {api,stats}=model();api.set({headerOpacity:.23});const count=stats().saves;
  const p=api.get();p.headerSceneProfiles.liquid.opacity=.99;
  assert.equal(api.get().headerOpacity,.23);api.set({headerOpacity:.23});assert.equal(stats().saves,count);
});

test('invalid header values cannot replace material defaults or introduce nonfinite alpha',()=>{
  for(const value of [NaN,Infinity,'0.1',null,undefined]){const {api}=model();api.set({headerOpacity:value});assert.equal(api.get().headerOpacity,.80);}
  const {normalize}=model();assert.equal(normalize({headerSceneProfiles:{liquid:{opacity:9}}}).headerOpacity,1);
  assert.equal(normalize({headerSceneProfiles:{liquid:{opacity:-1}}}).headerOpacity,0);
});

test('every surface and global-window percentage combines continuously including both endpoints',()=>{
  const {windowSurfaceOpacity}=model();
  for(let surface=0;surface<=100;surface++) for(let window=0;window<=100;window++){
    const alpha=windowSurfaceOpacity({opacity:1-surface/100,windowOpacity:1-window/100});
    assert.ok(Number.isFinite(alpha)&&alpha>=0&&alpha<=1);
    assert.ok(Math.abs(alpha-(1-surface/100)*(1-window/100))<1e-12);
    if(surface===100||window===100)assert.equal(alpha,0);
    if(window===0)assert.equal(alpha,1-surface/100);
  }
});

test('surface slider changes dialog fill while composer, component and conversation stay independent',()=>{
  for(const glass of ['liquid','frosted']){
    const {api,windowSurfaceOpacity}=model({glass,windowOpacity:.6,composerOpacity:.9,componentOpacity:.83,conversationOpacity:.5});
    for(const opacity of [1,.75,.25,0]){
      api.set({opacity});const p=api.get();assert.equal(windowSurfaceOpacity(p),opacity*.6);
      assert.deepEqual([p.composerOpacity,p.componentOpacity,p.conversationOpacity],[.9,.83,.5]);
    }
    api.resetSetting('windowOpacity');assert.equal(api.get().windowOpacity,1);
    api.resetSetting('opacity');assert.equal(windowSurfaceOpacity(api.get()),glass==='liquid'?.80:.50);
  }
});
