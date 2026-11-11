// Native optical-header regression against the accepted first 1.0.5 upgrade.
// Reuses the existing synthetic fixture, not its tests; never rewrites renderer source.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.SAO_TEST_PLAYWRIGHT ?? 'C:/DSH/graduation-office/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright');
const evidence=process.env.SAO_HEADER_OPTICS_EVIDENCE ?? 'C:/SAO/releases/1.0.5/header-optics/fixture';
const archive=process.env.SAO_HEADER_OPTICS_BEFORE ?? 'C:/SAO/releases/1.0.5/liquid-optics/dsh-SAO-1.0.5.zip';
const currentFile=new URL('../source/liquid-glass.js',import.meta.url);
const sha=source=>crypto.createHash('sha256').update(source).digest('hex');
const originalFixture=fs.readFileSync(new URL('./liquid-optics-browser.test.mjs',import.meta.url),'utf8');
const css=originalFixture.match(/const css = `([\s\S]+?)`;/)?.[1];
const fixture=originalFixture.match(/function fixture\(\) \{[\s\S]+?(?=\nconst html =)/)?.[0];
assert.ok(css&&fixture,'existing native fixture boundaries must remain explicit');

function headerFixture() {
  const luma=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  window.setupHeader=async({geometry,theme,kind})=>{
    document.documentElement.dataset.theme=theme;makeHosts(1,geometry);
    if(geometry==='thin') {
      hosts[0].querySelector('.content').style.cssText='margin:0 24px;height:48px;display:flex;align-items:center;gap:24px';
      hosts[0].querySelector('.content').innerHTML='<strong style="font-size:15px">SAO</strong><span style="font-size:14px">Conversations</span><span style="font-size:14px;opacity:.65">Models · Settings</span>';
    }
    await wallpaper(kind);await configure({enabled:true,opacity:.5,wallOpacity:1,edgeOnlySurfaces:undefined,surfaceOpenEdges:undefined});
  };
  window.headerMetrics=()=>{
    const frame=raw(), reference=wallpapers[kind].canvas.getContext('2d').getImageData(0,0,innerWidth,innerHeight).data;
    const w=frame.rect.width,h=frame.rect.height;
    function sample(x,y) {
      const px=Math.min(frame.width-1,Math.max(0,Math.floor(x*frame.width/w))),py=Math.min(frame.height-1,Math.max(0,Math.floor(y*frame.height/h))),i=(py*frame.width+px)*4;
      const rx=Math.min(innerWidth-1,Math.max(0,Math.floor(frame.rect.x+x))),ry=Math.min(innerHeight-1,Math.max(0,Math.floor(frame.rect.y+y))),r=(ry*innerWidth+rx)*4;
      const source=[...reference.slice(r,r+3)],rgb=frame.data.slice(i,i+3),alpha=frame.data[i+3]/255;
      const under=source.map((v,c)=>v*(1-options.opacity)+options.baseColor[c]*255*options.opacity);
      // Lighting-only visible excess over the supplied flat scene avoids mistaking
      // re-exposure of wallpaper through the CSS fill for a white specular halo.
      const signedLight=(luma(rgb)-luma(source))*alpha;
      return {positiveLight:Math.max(0,signedLight),signedLight,visibleError:rgb.reduce((n,v,c)=>n+Math.abs(v-source[c])*alpha/3,0),composedDelta:(luma(rgb)-luma(under))*alpha,chroma:(Math.max(...rgb)-Math.min(...rgb))*alpha,sourceChroma:Math.max(...rgb)-Math.min(...rgb),alpha};
    }
    const edges=[];
    for(const side of ['top','bottom','left','right']) {
      const horizontal=side==='top'||side==='bottom',extent=horizontal?w:h,margin=Math.min(60,extent*.4),line=[];
      for(let along=Math.ceil(margin);along<extent-margin;along++) {
        let positive=0,signed=0,composed=0,n=0;
        for(let depth=1.5;depth<6.5;depth++) {
          const x=horizontal?along+.5:side==='left'?depth:w-depth,y=horizontal?(side==='top'?depth:h-depth):along+.5;
          const p=sample(x,y);positive+=p.positiveLight;signed+=p.signedLight;composed+=p.composedDelta;n++;
        }
        line.push({positive:positive/n,signed:signed/n,composed:composed/n});
      }
      let run=0,longest=0;for(const p of line){run=p.positive>1?run+1:0;longest=Math.max(longest,run);}
      const values=line.map(p=>p.positive).sort((a,b)=>a-b),mean=key=>line.reduce((n,p)=>n+p[key],0)/Math.max(1,line.length);
      edges.push({side,positiveMean:mean('positive'),signedMean:mean('signed'),composedMeanDelta:mean('composed'),positiveP95:values[Math.min(values.length-1,Math.floor(values.length*.95))]||0,brightCoverage:line.filter(p=>p.positive>1).length/Math.max(1,line.length),longestBrightFraction:longest/Math.max(1,line.length)});
    }
    let center=0,centerCount=0,edgeChroma=0,edgeDifference=0,edgeCount=0;
    for(let x=60;x<w-60;x++)for(let y=0;y<h;y++) {
      const p=sample(x+.5,y+.5),depth=Math.min(y+.5,h-y-.5);
      if(Math.abs(y+.5-h/2)<3){center+=p.visibleError;centerCount++;}
      if(depth>1&&depth<Math.min(12,h*.3)&&p.alpha>.05){edgeChroma=Math.max(edgeChroma,p.sourceChroma);edgeDifference+=p.visibleError;edgeCount++;}
    }
    // Curved caps cross the grayscale pattern at oblique angles; straight top/bottom
    // strips can have zero channel separation even in the accepted source.
    let curvedEdgeSourceChroma=0,curvedEdgeVisibleChroma=0;
    for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++) {
      const i=(y*frame.width+x)*4,a=frame.data[i+3]/255,xx=(x+.5)*w/frame.width,yy=(y+.5)*h/frame.height;
      if(a<.02||Math.min(xx,w-xx,yy,h-yy)>Math.min(24,h*.5))continue;
      const rgb=frame.data.slice(i,i+3),chroma=Math.max(...rgb)-Math.min(...rgb);
      curvedEdgeSourceChroma=Math.max(curvedEdgeSourceChroma,chroma);curvedEdgeVisibleChroma=Math.max(curvedEdgeVisibleChroma,chroma*a);
    }
    return {edges,meanPositiveEdge:edges.reduce((n,e)=>n+e.positiveMean,0)/4,meanBrightCoverage:edges.reduce((n,e)=>n+e.brightCoverage,0)/4,continuousBrightSides:edges.filter(e=>e.longestBrightFraction>.9).length,centerVisibleMAE:center/Math.max(1,centerCount),edgeSourceChroma:edgeChroma,curvedEdgeSourceChroma,curvedEdgeVisibleChroma,edgeVisibleMAE:edgeDifference/Math.max(1,edgeCount),edgeCount};
  };
  window.headerBenchmark=async geometry=>{
    await setupHeader({geometry,theme:'light',kind:'grid'});const samples=[];resetWork();window.gpuTimerEnabled=true;
    for(let i=0;i<24;i++){hosts[0].style.transform=`translateX(${1+i%2}px)`;const start=performance.now();api.refreshLayout();samples.push(performance.now()-start);await paint(1);}
    window.gpuTimerEnabled=false;return {cpuRefreshMs:samples,work:counter(),timer:await gpuTimes()};
  };
}
const html=`<!doctype html><html data-theme="light"><head><meta charset="utf-8"><style>${css}</style></head><body><img id="wall" alt="Synthetic wallpaper"><div id="hosts"></div><div id="local"><div></div></div><script src="/renderer.js"></script><script>${fixture};fixture();(${headerFixture.toString()})();</script></body></html>`;
const stats=values=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return {median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],count:values.length};};
const png=(name,data)=>fs.writeFileSync(path.join(evidence,name+'.png'),Buffer.from(data.split(',')[1],'base64'));

test('native header optics: accepted upgrade versus directional glints',{timeout:180000},async t=>{
  fs.mkdirSync(evidence,{recursive:true});
  const extracted=spawnSync(process.env.SAO_TEST_PYTHON??'python',['-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);n=[n for n in z.namelist() if n.endswith("/source/liquid-glass.js") and "/market/" not in n];assert len(n)==1,n;sys.stdout.buffer.write(z.read(n[0]))',archive],{maxBuffer:2e6});
  assert.equal(extracted.status,0,extracted.stderr?.toString()||extracted.error?.message);
  const before=extracted.stdout.toString('utf8'),current=fs.readFileSync(currentFile,'utf8');
  assert.equal(sha(before),'2278102a45410268bb188ea76e98b1bc264b9eb113307707b1aaed2033833af9','before must be the accepted first upgrade');
  const report={archive,beforeSHA256:sha(before),currentSHA256:sha(current),fixtureSHA256:sha(originalFixture),createdAt:new Date().toISOString(),scope:'native isolated localhost, actual accepted/current source, no live GUI/storage',visual:[],performance:[]};
  t.after(()=>{report.finalSourceSHA256=sha(fs.readFileSync(currentFile));report.sourceStableThroughoutRun=report.finalSourceSHA256===report.currentSHA256;fs.writeFileSync(path.join(evidence,'header-results.json'),JSON.stringify(report,null,2));});
  fs.writeFileSync(path.join(evidence,'before-liquid-glass.js'),before);fs.writeFileSync(path.join(evidence,'current-liquid-glass.js'),current);fs.writeFileSync(path.join(evidence,'fixture.html'),html);
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url.startsWith('/renderer.js')?'text/javascript':'text/html; charset=utf-8');res.end(req.url.startsWith('/renderer.js')?(req.url.includes('before')?before:current):html.replace('/renderer.js',req.url.includes('before')?'/renderer.js?before':'/renderer.js?current'));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const browser=await chromium.launch({channel:'msedge',headless:true});report.browser=browser.version();t.after(()=>browser.close());
  const pages=[];
  for(const variant of ['before','current']) {
    const page=await browser.newPage({viewport:{width:1000,height:700},deviceScaleFactor:1,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    t.after(async()=>{if(!page.isClosed()){await page.evaluate(()=>api.dispose());await page.close();}assert.deepEqual(errors,[]);});
    await page.goto(`http://127.0.0.1:${server.address().port}/?${variant}`);await page.bringToFront();await page.evaluate(()=>setupHeader({geometry:'thin',theme:'light',kind:'flat'}));
    const state=await page.evaluate(()=>snapshot());assert.ok(state.work.draws>0);assert.ok(state.canvases[0]?.ink>1000);assert.equal(state.glError,0);assert.equal(state.work.contexts,1);report.gpu=state.gpu;pages.push({variant,page});
  }
  await t.test('thin header and card: flat-field halo energy and continuous perimeter coverage decrease',async()=>{
    for(const geometry of ['thin','card'])for(const theme of ['light','dark'])for(const kind of ['flat','muted','dark','white']) {
      const pair=[];
      for(const {variant,page}of pages) {
        await page.bringToFront();await page.evaluate(setup=>setupHeader(setup),{geometry,theme,kind});const metrics=await page.evaluate(()=>headerMetrics()),raw=await page.evaluate(()=>window.raw());
        const name=`${variant}-${geometry}-${theme}-${kind}`;png(name+'-overlay',raw.png);
        await page.screenshot({path:path.join(evidence,name+'-composed.png'),clip:geometry==='thin'?{x:80,y:110,width:800,height:88}:{x:80,y:110,width:500,height:300}});
        report.visual.push({variant,geometry,theme,kind,metrics});pair.push({metrics,png:raw.png});
      }
      png(`difference-${geometry}-${theme}-${kind}`,await pages[1].page.evaluate(({a,b})=>exportDifference(a,b),{a:pair[0].png,b:pair[1].png}));
      const [old,after]=pair.map(p=>p.metrics);
      assert.ok(after.centerVisibleMAE<.8,`${geometry}/${theme}/${kind}: center lighting remains quiet (${after.centerVisibleMAE})`);
      if(kind==='flat'||kind==='muted') {
        assert.ok(old.meanPositiveEdge>.2,'accepted-source positive-light control is meaningful');
        assert.ok(after.meanPositiveEdge<=old.meanPositiveEdge*.65+.05,`${geometry}/${theme}/${kind}: edge lighting excess ${old.meanPositiveEdge} -> ${after.meanPositiveEdge}`);
        assert.ok(after.meanBrightCoverage<=old.meanBrightCoverage*.65+.05,`${geometry}/${theme}/${kind}: continuous bright perimeter coverage ${old.meanBrightCoverage} -> ${after.meanBrightCoverage}`);
        assert.ok(after.continuousBrightSides<old.continuousBrightSides,`${geometry}/${theme}/${kind}: all-around bright rim becomes directional`);
      }
    }
  });
  await t.test('grayscale and colored fiducials retain optical edges rather than passing by disabling optics',async()=>{
    for(const geometry of ['thin','card'])for(const theme of ['light','dark'])for(const kind of ['gray-grid','grid'])for(const {variant,page}of pages) {
      await page.bringToFront();await page.evaluate(setup=>setupHeader(setup),{geometry,theme,kind});const metrics=await page.evaluate(()=>headerMetrics());report.visual.push({variant,geometry,theme,kind,metrics});
      const raw=await page.evaluate(()=>window.raw());png(`${variant}-${geometry}-${theme}-${kind}-overlay`,raw.png);
      await page.screenshot({path:path.join(evidence,`${variant}-${geometry}-${theme}-${kind}-composed.png`),clip:geometry==='thin'?{x:80,y:110,width:800,height:88}:{x:80,y:110,width:500,height:300}});
    }
    // Save the complete pattern matrix before asserting, preserving evidence even on failure.
    for(const {geometry,theme,kind,metrics}of report.visual.filter(x=>x.variant==='current'&&(x.kind==='grid'||x.kind==='gray-grid'))) {
      assert.ok(metrics.edgeCount>100);assert.ok(metrics.edgeVisibleMAE>.5,'pattern edge remains visibly different from flat sampling');
      if(kind==='gray-grid') {
        const control=report.visual.find(x=>x.variant==='before'&&x.geometry===geometry&&x.theme===theme&&x.kind===kind).metrics;
        assert.ok(control.curvedEdgeSourceChroma>12,'accepted curved-edge chroma positive control is meaningful');
        assert.ok(metrics.curvedEdgeSourceChroma>12&&metrics.curvedEdgeVisibleChroma>.5,'real channel separation remains visible at grayscale curved edges');
      }
    }
  });
  await t.test('same actual layout workload retains one shared context, raster/copy/upload bounds and paired native timings',async()=>{
    for(const {variant,page}of pages)for(const geometry of ['thin','card']) {
      await page.bringToFront();const result=await page.evaluate(geometry=>headerBenchmark(geometry),geometry);
      assert.equal(result.work.contexts,1);assert.equal(result.work.draws,24);assert.equal(result.work.copies,24);assert.equal(result.work.uploads,0);assert.ok(result.work.pixels<=24*180000);
      const item={variant,geometry,refreshCpuMs:stats(result.cpuRefreshMs),work:result.work,gpuTimer:{supported:result.timer.supported,elapsedMs:stats(result.timer.milliseconds),droppedDisjoint:result.timer.droppedDisjoint,unavailable:result.timer.unavailable}};report.performance.push(item);
    }
    for(const geometry of ['thin','card']) {
      const old=report.performance.find(x=>x.variant==='before'&&x.geometry===geometry),after=report.performance.find(x=>x.variant==='current'&&x.geometry===geometry);
      assert.ok(after.refreshCpuMs.median<=old.refreshCpuMs.median*2+1);assert.ok(after.refreshCpuMs.p95<=old.refreshCpuMs.p95*2.5+3);
      if(old.gpuTimer.elapsedMs&&after.gpuTimer.elapsedMs)assert.ok(after.gpuTimer.elapsedMs.median<=old.gpuTimer.elapsedMs.median*1.5+.1);
    }
    report.timingNote='24 real layout invalidations per pair; no readback in timed path. CPU refresh and asynchronous non-disjoint native GPU draw elapsed are separate. GPU excludes clears/copies/compositor. Broad same-machine guards are not universal frame SLAs. Old liquid-optics suite independently retains endpoints, masks, idle, source cache and context recovery.';
    assert.equal(sha(fs.readFileSync(currentFile)),report.currentSHA256,'renderer stays frozen throughout focused run');
  });
});
