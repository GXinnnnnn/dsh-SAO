import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const source=readFileSync(new URL('../source/appearance.js',import.meta.url),'utf8');
const start=source.indexOf('  const defaults = '),end=source.indexOf('  let preferences;');
const apiStart=source.indexOf('  const api = {'),apiEnd=source.indexOf('    setTheme: changeTheme,',apiStart);
const reset=source.match(/^    async reset\(\) \{[^\n]+\}/m)?.[0];
assert.ok(start>=0&&end>start&&apiStart>end&&apiEnd>apiStart&&reset);
const factory=new Function('builtins','initial',`${source.slice(start,end)}
let preferences=normalize(initial),disposed=false,notice='',revision=0,saves=0;
const announceMode=()=>{},applyTokens=()=>{},persist=()=>{saves++;},schedule=()=>{},sync=()=>{};
const readThemePreference=()=>preferences.theme,changeTheme=async()=>{};
${source.slice(apiStart,apiEnd)}
${reset}
}; return {api,normalize,stats:()=>({saves})};`);
const model=initial=>factory([],initial||{});
const areaStart=source.indexOf('  function wallpaperArea('),areaEnd=source.indexOf('  let imageBounds',areaStart);
assert.ok(areaStart>=0&&areaEnd>areaStart);
const area=new Function(`${source.slice(areaStart,areaEnd)} return wallpaperArea;`)();
test('new and existing preferences preserve full wallpaper by default; invalid ranges normalize safely',()=>{
 for(const value of [undefined,null,'bad',{},true,0])assert.equal(model({wallpaperScope:value}).api.get().wallpaperScope,'full');
 assert.equal(model().api.getDefault('wallpaperScope'),'full');
});
test('switch persists through reload and reset without changing unrelated personal settings',async()=>{
 const {api}=model({wallX:73,wallY:29,wallScale:187,wallOpacity:.31,opacity:.66,headerOpacity:.17,theme:'dark',wallpaper:'builtin-7'});
 const before=api.get();api.set({wallpaperScope:'conversation'});
 const expected={...before,wallpaperScope:'conversation'};assert.deepEqual(api.get(),expected);
 const reload=model(JSON.parse(JSON.stringify(api.get()))).api;assert.deepEqual(reload.get(),expected);
 reload.resetSetting('wallpaperScope');assert.deepEqual(reload.get(),before);
 reload.set({wallpaperScope:'conversation'});await reload.reset();assert.equal(reload.get().wallpaperScope,'full');
});
test('repeated range selection is a save no-op',()=>{
 const {api,stats}=model();api.set({wallpaperScope:'conversation'});const n=stats().saves;
 api.set({wallpaperScope:'conversation'});assert.equal(stats().saves,n);
});
test('full area retains prior coordinates; conversation cover excludes docked right column and collapsed rail',()=>{
 const scene={x:280,y:40,width:1640,height:992},conversation={x:280,y:40,width:1064,height:992};
 assert.deepEqual(area('full',scene,conversation),scene);assert.deepEqual(area('conversation',scene,conversation),conversation);
 const rail={...scene,x:224,width:1696};assert.deepEqual(area('full',rail,conversation),rail);assert.deepEqual(area('conversation',rail,conversation),conversation);
 const returned=area('conversation',scene,conversation);returned.width=1;assert.equal(conversation.width,1064);
});
test('range geometry follows resized conversation without altering full-width layout',()=>{
 for(const [width,rightWidth] of [[1064,576],[1400,240],[1640,0],[300,900]]){
  const scene={x:280,y:40,width:width+rightWidth,height:700},conversation={x:280,y:40,width,height:700};
  assert.equal(area('conversation',scene,conversation).width,width);assert.equal(area('full',scene,conversation).width,width+rightWidth);
 }
});
