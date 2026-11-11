// Real native WebGL2 optical regression. No production storage, live GUI or GL mocks.
// Run: node --test tests/liquid-optics-browser.test.mjs
// Evidence defaults outside the checkout. Missing native browser/dependency is a failure.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SAO_TEST_PLAYWRIGHT ?? 'C:/DSH/graduation-office/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright');
const evidence = process.env.SAO_OPTICS_EVIDENCE ?? 'C:/SAO/releases/1.0.5/liquid-optics/fixture';
const archive = process.env.SAO_OPTICS_BEFORE ?? 'C:/SAO/backups/1.0.5-before-liquid-optics.zip';
const currentFile = new URL('../source/liquid-glass.js', import.meta.url);
const sha = input => crypto.createHash('sha256').update(input).digest('hex');

const css = `html,body{margin:0;width:100%;height:100%;font:16px Arial,sans-serif;overflow:hidden;background:#e7eff7;color:#172332}
#wall{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
.host{position:absolute;isolation:isolate;border-radius:28px;--fill:.5;--base:231,239,247}
.host::before{content:"";position:absolute;inset:0;border-radius:inherit;background:rgba(var(--base),var(--fill));z-index:-1;pointer-events:none}
.host .content{position:relative;z-index:1;margin:46px 44px;pointer-events:none}
.content h2{font-size:26px;margin:0 0 12px;font-weight:600}.content p{line-height:1.55;margin:0}.content code{font:13px monospace}
html[data-theme=dark] body{color:#edf2f7;background:#151b24}
#local{position:fixed;right:0;top:0;width:20px;height:60px;overflow:auto}#local>div{height:2000px}
`;

// Instrumentation observes and forwards native methods unchanged. Readback is outside timing.
function fixture() {
  const nativeRAF = requestAnimationFrame.bind(window), contexts = new Set(), sharedCanvases = new Set();
  const viewports = new WeakMap(), timerExtensions = new WeakMap();
  window.work = { draws: 0, copies: 0, uploads: 0, contexts: 0, frames: 0, pixels: 0, drawCpuMs: 0, copyCpuMs: 0, viewports: [], textures: [] };
  window.gpuQueries = []; window.gpuTimerEnabled = false; window.gpuTimerAvailable = false;
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const context = getContext.call(this, type, ...args);
    if (type === 'webgl2' && context && !contexts.has(context)) {
      contexts.add(context); sharedCanvases.add(this); window.testGL = context; work.contexts++;
      const debug = context.getExtension('WEBGL_debug_renderer_info');
      window.gpu = { version: context.getParameter(context.VERSION), vendor: context.getParameter(debug?.UNMASKED_VENDOR_WEBGL || context.VENDOR), renderer: context.getParameter(debug?.UNMASKED_RENDERER_WEBGL || context.RENDERER) };
      const timer = context.getExtension('EXT_disjoint_timer_query_webgl2'); timerExtensions.set(context, timer); window.gpuTimerAvailable = !!timer;
    }
    return context;
  };
  const viewport = WebGL2RenderingContext.prototype.viewport;
  WebGL2RenderingContext.prototype.viewport = function(...args) { viewports.set(this, args.slice(2)); return viewport.apply(this, args); };
  const draw = WebGL2RenderingContext.prototype.drawArrays;
  WebGL2RenderingContext.prototype.drawArrays = function(...args) {
    const extent = viewports.get(this) || [0,0]; work.pixels += extent[0] * extent[1]; work.viewports.push(extent); work.draws++;
    const timer = timerExtensions.get(this), query = gpuTimerEnabled && timer ? this.createQuery() : null;
    if (query) this.beginQuery(timer.TIME_ELAPSED_EXT, query);
    const start = performance.now(); const result = draw.apply(this, args); work.drawCpuMs += performance.now() - start;
    if (query) { this.endQuery(timer.TIME_ELAPSED_EXT); gpuQueries.push({ gl: this, timer, query }); }
    return result;
  };
  const upload = WebGL2RenderingContext.prototype.texImage2D;
  WebGL2RenderingContext.prototype.texImage2D = function(...args) {
    work.uploads++; const source = args.length === 6 ? args[5] : null;
    work.textures.push(source ? [source.width, source.height] : [args[3], args[4]]);
    return upload.apply(this, args);
  };
  const copy = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
    if (!sharedCanvases.has(image)) return copy.call(this, image, ...args);
    const start = performance.now(); const result = copy.call(this, image, ...args); work.copyCpuMs += performance.now() - start; work.copies++; return result;
  };
  window.requestAnimationFrame = fn => { work.frames++; return nativeRAF(fn); };
  window.paint = async (count = 5) => { for (let i = 0; i < count; i++) await new Promise(nativeRAF); };
  window.counter = () => structuredClone(work);
  window.resetWork = () => { for (const key of Object.keys(work)) work[key] = Array.isArray(work[key]) ? [] : 0; work.contexts = contexts.size; };
  window.hosts = [];
  window.makeHosts = (count = 1, geometry = 'card') => {
    window.api?.update({ enabled: false }); document.querySelector('#hosts').replaceChildren(); window.hosts = [];
    for (let i = 0; i < count; i++) {
      const host = document.createElement('section'); host.className = 'host'; host.dataset.index = i;
      let box = [100, 130, 460, 260];
      if (count > 1) box = [15 + (i % 4) * 245, 30 + Math.floor(i / 4) * 200, 210, 150];
      if (geometry === 'large') box = [20, 20, 960, 660];
      if (geometry === 'thin') box = [100, 130, 760, 48];
      if (geometry === 'join') box = [100 + i * 300, 130, 300, 260];
      host.style.cssText = `left:${box[0]}px;top:${box[1]}px;width:${box[2]}px;height:${box[3]}px;`;
      if (geometry === 'ellipse') host.style.borderRadius = '100px 40px 0 80px / 60px 90px 0 25px';
      if (geometry === 'square') host.style.borderRadius = '0px 20px 20px 20px / 30px 20px 20px 20px';
      if (geometry === 'join') host.style.borderRadius = i ? '0 28px 28px 0' : '28px 0 0 28px';
      host.innerHTML = '<div class="content"><h2>Quiet center. Optical edge.</h2><p>Actual DOM text stays readable over the wallpaper.<br><code>SAO 1.0.5 · synthetic native-WebGL fixture</code></p></div>';
      document.querySelector('#hosts').append(host); hosts.push(host);
    }
  };
  window.wallpapers = {};
  window.wallpaper = async kind => {
    if (!wallpapers[kind]) {
      const canvas = document.createElement('canvas'); canvas.width = innerWidth; canvas.height = innerHeight;
      const c = canvas.getContext('2d');
      const flat = { white: '#ffffff', dark: '#080b10', flat: '#808080', muted: '#53756c' };
      if (flat[kind]) { c.fillStyle = flat[kind]; c.fillRect(0,0,canvas.width,canvas.height); }
      else {
        c.fillStyle = '#eeeeee'; c.fillRect(0,0,canvas.width,canvas.height);
        for (let y = 0; y < canvas.height; y += 16) for (let x = 0; x < canvas.width; x += 16) {
          c.fillStyle = ((x / 16 + y / 16) % 2) ? '#eeeeee' : '#181818'; c.fillRect(x,y,16,16);
        }
        if (kind !== 'gray-grid') {
          for (const [index, color] of ['#ed2751','#24c9ab','#2589f4','#f4bd33'].entries()) { c.fillStyle = color; c.fillRect(40+index*210,0,34,canvas.height); }
          c.font = 'bold 28px Arial'; c.fillStyle = '#ffffff'; for(let x=0;x<canvas.width;x+=105) c.fillText(String(x),x+3,90);
        }
        if (kind === 'transparent') { c.clearRect(150,180,180,130); c.fillStyle = 'rgba(250,40,90,.3)'; c.fillRect(170,200,140,90); }
      }
      const image = new Image(); image.src = canvas.toDataURL(); await image.decode(); wallpapers[kind] = { image, canvas };
    }
    window.picture = wallpapers[kind].image; document.querySelector('#wall').src = picture.src; window.kind = kind;
  };
  window.configure = async (next = {}) => {
    window.options = { ...(window.options || { enabled: true, opacity: .5, wallOpacity: 1, position: { x:50, y:50, scale:100 } }), ...next, surfaces: hosts, image: picture };
    const base = document.documentElement.dataset.theme === 'dark' ? [21/255,27/255,36/255] : [231/255,239/255,247/255];
    options.baseColor = next.baseColor || base;
    for (const host of hosts) { host.style.setProperty('--fill', options.opacity); host.style.setProperty('--base', options.baseColor.map(v=>Math.round(v*255)).join(',')); }
    if (next.join) options.surfaceOpenEdges = new Map(hosts.map((host,i) => [host, { left:i>0, right:i<hosts.length-1 }]));
    delete options.join;
    api.update(options); await paint(); return snapshot();
  };
  window.snapshot = () => ({ work: counter(), gpu, canvases: hosts.map(host => {
    const canvas = host.querySelector('[data-sao-liquid]'); if (!canvas) return null;
    const data = canvas.width && canvas.height ? canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data : [];
    let ink = 0, alpha = 0; for(let i=3;i<data.length;i+=4) { if(data[i]) ink++; alpha += data[i]; }
    return { hidden: canvas.hidden, width: canvas.width, height: canvas.height, ink, alpha };
  }), glError: testGL?.getError() });
  window.raw = (index = 0) => {
    const host = hosts[index], canvas = host.querySelector('[data-sao-liquid]');
    if (!canvas || canvas.hidden) return null;
    const { width, height } = canvas; const rect = canvas.getBoundingClientRect();
    const data = canvas.getContext('2d').getImageData(0,0,width,height).data;
    return { width, height, rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}, data: [...data], png:canvas.toDataURL() };
  };
  window.analyze = () => {
    const frame = raw(), ref = wallpapers[kind].canvas.getContext('2d').getImageData(0,0,innerWidth,innerHeight).data;
    let centerError=0, centerSourceError=0, centerCount=0, centerAlpha=0, centerChroma=0, innerChroma=0, edgeChroma=0, edgeCount=0, edgeInk=0, edgeDeviation=0;
    for(let y=0;y<frame.height;y++) for(let x=0;x<frame.width;x++) {
      const localX=(x+.5)*frame.rect.width/frame.width, localY=(y+.5)*frame.rect.height/frame.height;
      const depth=Math.min(localX,localY,frame.rect.width-localX,frame.rect.height-localY), i=(y*frame.width+x)*4;
      const rx=Math.min(innerWidth-1,Math.floor(frame.rect.x+localX)), ry=Math.min(innerHeight-1,Math.floor(frame.rect.y+localY));
      const r=(ry*innerWidth+rx)*4, a=ref[r+3]/255;
      const expected=[0,1,2].map(c=>(ref[r+c]*a + options.baseColor[c]*255*(1-a))*options.wallOpacity + options.baseColor[c]*255*(1-options.wallOpacity));
      const error=[0,1,2].reduce((sum,c)=>sum+Math.abs(frame.data[i+c]-expected[c]),0)/3;
      const chroma=Math.max(...frame.data.slice(i,i+3))-Math.min(...frame.data.slice(i,i+3));
      // Compare visible premultiplied contributions: unpremultiplied RGB at alpha 9/255 has ±14-code quantization.
      const overlayAlpha=frame.data[i+3]/255;
      if(depth>50 && frame.data[i+3]>0) {centerError+=error*overlayAlpha;centerSourceError+=error;centerAlpha+=frame.data[i+3];centerCount++;centerChroma=Math.max(centerChroma,chroma*overlayAlpha);}
      if(localX>60 && localX<frame.rect.width-60 && depth>26 && depth<50) innerChroma=Math.max(innerChroma,chroma*overlayAlpha);
      // Straight top/bottom edges avoid corner shape and DOM text.
      if(localX>60 && localX<frame.rect.width-60 && depth>1 && depth<24 && frame.data[i+3]>0) { edgeCount++; edgeDeviation+=error; edgeChroma=Math.max(edgeChroma,chroma); if(error>8) edgeInk++; }
    }
    return { centerPremultipliedMAE:centerError/Math.max(1,centerCount), centerSourceMAE:centerSourceError/Math.max(1,centerCount), centerMeanAlpha:centerAlpha/Math.max(1,centerCount), centerPremultipliedChroma:centerChroma, innerPremultipliedChroma:innerChroma, edgeSourceMAE:edgeDeviation/Math.max(1,edgeCount), edgeChangedFraction:edgeInk/Math.max(1,edgeCount), edgeSourceChroma:edgeChroma, centerCount, edgeCount };
  };
  window.exportDifference = async (before, after) => {
    const a=new Image(), b=new Image(); a.src=before; b.src=after; await Promise.all([a.decode(),b.decode()]);
    const c=document.createElement('canvas'); c.width=a.width; c.height=a.height; const ctx=c.getContext('2d');
    ctx.drawImage(a,0,0); const ad=ctx.getImageData(0,0,c.width,c.height); ctx.clearRect(0,0,c.width,c.height); ctx.drawImage(b,0,0); const bd=ctx.getImageData(0,0,c.width,c.height);
    for(let i=0;i<ad.data.length;i+=4) {const v=Math.min(255,Math.max(...[0,1,2,3].map(ch=>Math.abs(ad.data[i+ch]-bd.data[i+ch])))*4); bd.data[i]=v;bd.data[i+1]=Math.round(v*.25);bd.data[i+2]=0;bd.data[i+3]=255;}
    ctx.putImageData(bd,0,0); return c.toDataURL();
  };
  window.gpuTimes = async () => {
    const results=[]; let dropped=0;
    for(let frame=0;gpuQueries.length && frame<120;frame++) {
      for(let i=gpuQueries.length-1;i>=0;i--) {
        const {gl,timer,query}=gpuQueries[i];
        if(gl.getParameter(timer.GPU_DISJOINT_EXT)) { gl.deleteQuery(query);gpuQueries.splice(i,1);dropped++; }
        else if(gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)) {results.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);gpuQueries.splice(i,1);}
      }
      if(gpuQueries.length) await new Promise(nativeRAF);
    }
    for(const {gl,query} of gpuQueries) gl.deleteQuery(query);
    const unavailable=gpuQueries.length;gpuQueries.length=0;
    return { supported:gpuTimerAvailable, milliseconds:results, droppedDisjoint:dropped, unavailable };
  };
  window.benchmark = async (count = 1, edgeOnly = false) => {
    makeHosts(count); await configure({enabled:true,opacity:.5,edgeOnlySurfaces:edgeOnly?new Set(hosts):undefined,surfaceOpenEdges:undefined});
    const samples=[];resetWork();window.gpuTimerEnabled=true;
    for(let i=0;i<24;i++) {
      // An actual layout change invalidates every host; no shader/source substitutions.
      for(const host of hosts) host.style.transform=`translateX(${1+i%2}px)`;
      const start=performance.now();api.refreshLayout();samples.push(performance.now()-start);await new Promise(nativeRAF);
    }
    window.gpuTimerEnabled=false;const cpu=counter(), timer=await gpuTimes();await paint();
    return {count,edgeOnly,cpuRefreshMs:samples,cpu,timer};
  };
  window.api = createSAOLiquidGlass();
}
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><style>${css}</style></head><body><img id="wall" alt="Synthetic diagnostic wallpaper"><div id="hosts"></div><div id="local"><div></div></div><script src="/renderer.js"></script><script>(${fixture.toString()})();</script></body></html>`;
const savePNG = (name, data) => fs.writeFileSync(path.join(evidence,name+'.png'), Buffer.from(data.split(',')[1],'base64'));
const stats = values => {
  if (!values.length) return null;
  const ordered=[...values].sort((a,b)=>a-b);return {median:ordered[Math.floor(ordered.length*.5)],p95:ordered[Math.min(ordered.length-1,Math.floor(ordered.length*.95))],count:values.length};
};
const delta = (after,before,key) => after[key]-before[key];

// Screenshots and alpha readback validate real output, not only successful shader compilation.
test('native liquid optics: archived/current pixels, budgets, lifecycle and measured work', {timeout:180000}, async t => {
  fs.mkdirSync(evidence,{recursive:true});
  const extracted=spawnSync(process.env.SAO_TEST_PYTHON ?? 'python',['-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);n=[n for n in z.namelist() if n.endswith("/source/liquid-glass.js") and "/market/" not in n];assert len(n)==1,n;sys.stdout.buffer.write(z.read(n[0]))',archive],{maxBuffer:2e6});
  assert.equal(extracted.status,0,extracted.stderr?.toString() || extracted.error?.message);
  const before=extracted.stdout.toString('utf8'),current=fs.readFileSync(currentFile,'utf8');
  fs.writeFileSync(path.join(evidence,'before-liquid-glass.js'),before);fs.writeFileSync(path.join(evidence,'current-liquid-glass.js'),current);fs.writeFileSync(path.join(evidence,'fixture.html'),html);
  const report={archive,beforeSHA256:sha(before),currentSHA256:sha(current),createdAt:new Date().toISOString(),scope:'isolated synthetic localhost; actual archived/current renderer; native WebGL2; no live GUI/storage',visual:[],checks:[],performance:[]};
  t.after(()=>fs.writeFileSync(path.join(evidence,'optics-results.json'),JSON.stringify(report,null,2)));
  const server=http.createServer((req,res)=>{
    if(req.url.startsWith('/renderer.js')) {res.setHeader('Content-Type','text/javascript');res.end(req.url.includes('before')?before:current);return;}
    if(req.url==='/foreign.svg') {res.setHeader('Content-Type','image/svg+xml');res.setHeader('Access-Control-Allow-Origin','*');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>');return;}
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html.replace('/renderer.js',req.url.includes('before')?'/renderer.js?before':'/renderer.js?current'));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const browser=await chromium.launch({channel:'msedge',headless:true});t.after(()=>browser.close());report.browser=browser.version();
  const pages=[];
  async function pageFor(variant='current',dpr=1) {
    const page=await browser.newPage({viewport:{width:1000,height:700},deviceScaleFactor:dpr,reducedMotion:'reduce'});pages.push(page);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    t.after(async()=>{if(!page.isClosed()) {await page.evaluate(()=>api.dispose());await page.close();}assert.deepEqual(errors,[],'fixture has no page errors');});
    await page.goto(`http://127.0.0.1:${server.address().port}/?${variant}`);await page.bringToFront();
    await page.evaluate(async()=>{makeHosts();await wallpaper('grid');await configure();});
    const state=await page.evaluate(()=>snapshot());assert.ok(state.work.draws>0,'native GL draw executed');assert.ok(state.canvases[0]?.ink>1000,'real GPU pixels reached 2D canvas');assert.equal(state.glError,0);
    report.gpu=state.gpu;return page;
  }
  const baseline=await pageFor('before'),page=await pageFor();
  await t.test('before/after pattern, white, dark and flat evidence with preserved center and confined dispersion',async()=>{
    for(const theme of ['light','dark']) for(const kind of ['grid','gray-grid','white','dark','flat']) {
      const frames=[];
      for(const [variant,target] of [['before',baseline],['current',page]]) {
        await target.bringToFront();
        await target.evaluate(async({theme,kind})=>{document.documentElement.dataset.theme=theme;await wallpaper(kind);await configure({opacity:.5,wallOpacity:1,surfaceOpenEdges:undefined,edgeOnlySurfaces:undefined});},{theme,kind});
        const metrics=await target.evaluate(()=>analyze()),raw=await target.evaluate(()=>window.raw());
        const name=`${variant}-${theme}-${kind}`;savePNG(name+'-overlay',raw.png);
        await target.screenshot({path:path.join(evidence,name+'-composed.png'),clip:{x:80,y:110,width:500,height:300}});
        frames.push({variant,metrics,png:raw.png});report.visual.push({variant,theme,kind,metrics});
      }
      savePNG(`difference-${theme}-${kind}`,await page.evaluate(({a,b})=>exportDifference(a,b),{a:frames[0].png,b:frames[1].png}));
      const after=frames[1].metrics;
      assert.ok(after.centerCount>1000);assert.ok(after.centerPremultipliedMAE<1.8,`${theme}/${kind} center visible error ${after.centerPremultipliedMAE}`);
      assert.ok(after.centerMeanAlpha<=12,`${theme}/${kind} center is a quiet overlay`);
      if(kind==='gray-grid') {
        assert.ok(after.centerPremultipliedChroma<=1.5,'no visible colored fringes in the flat interior');
        assert.ok(after.innerPremultipliedChroma<=1.5,'dispersion does not extend beyond the curved 24px bezel');
        assert.ok(after.centerPremultipliedMAE<frames[0].metrics.centerPremultipliedMAE*.5,'center preservation improves against actual archived renderer');
        assert.ok(after.edgeSourceMAE>after.centerSourceMAE+3,'real bending/lighting is confined to the bezel');
        assert.ok(after.edgeChangedFraction>.1,'edge output differs visibly from flat sampling');
        assert.ok(after.edgeSourceChroma>after.centerPremultipliedChroma/Math.max(.001,after.centerMeanAlpha/255),'channel separation appears at high contrast edges, not throughout the card');
      }
    }
  });
  await page.bringToFront();
  await t.test('opacity endpoints, rounded/elliptical/square masks and edge-only interior',async()=>{
    await page.evaluate(async()=>{document.documentElement.dataset.theme='light';await wallpaper('grid');await configure({opacity:.5});});
    for(const opacity of [0,1]) {
      const work=await page.evaluate(()=>counter());const state=await page.evaluate(value=>configure({opacity:value}),opacity);
      assert.equal(state.work.draws,work.draws,`alpha ${opacity} draws nothing`);assert.equal(state.work.copies,work.copies);assert.equal(state.canvases[0].hidden,true);
    }
    for(const geometry of ['card','ellipse','square','thin','large']) {
      await page.evaluate(async geometry=>{makeHosts(1,geometry);await configure({enabled:true,opacity:.5});},geometry);
      const state=await page.evaluate(()=>snapshot()),raw=await page.evaluate(()=>window.raw());
      assert.ok(state.canvases[0].ink>100);assert.ok(raw.width<=1024&&raw.height<=1024&&raw.width*raw.height<=180000);
      if(geometry==='card'||geometry==='ellipse') assert.equal(raw.data[3],0,'rounded top-left corner stays transparent');
      if(geometry==='square') assert.ok(raw.data[3]>0,'zero radius axis yields a square corner');
      savePNG('geometry-'+geometry,raw.png);
    }
    await page.evaluate(async()=>{makeHosts();await configure({enabled:true,edgeOnlySurfaces:new Set(hosts)});});
    const raw=await page.evaluate(()=>window.raw());const center=((Math.floor(raw.height/2)*raw.width)+Math.floor(raw.width/2))*4;
    assert.equal(raw.data[center+3],0,'edge-only center discarded before texture work');
    report.checks.push('opacity endpoints; card/ellipse/zero-axis/thin/large masks; edge-only transparent center');
  });
  await t.test('open joins remove internal optical wall',async()=>{
    await page.evaluate(async()=>{makeHosts(2,'join');await wallpaper('flat');await configure({enabled:true,opacity:.5,edgeOnlySurfaces:new Set(hosts),join:true});});
    const joined=await page.evaluate(()=>[raw(0),raw(1)]);
    for(const [i,raw] of joined.entries()) {
      const x=i?0:raw.width-1,y=Math.floor(raw.height/2);assert.equal(raw.data[(y*raw.width+x)*4+3],0,'open seam is optically transparent at midheight');savePNG('open-join-'+i,raw.png);
    }
    await page.screenshot({path:path.join(evidence,'open-join-composed.png'),clip:{x:80,y:110,width:640,height:300}});
    await page.evaluate(()=>configure({surfaceOpenEdges:undefined}));const closed=await page.evaluate(()=>[raw(0),raw(1)]);
    for(const [i,raw] of closed.entries()) {const x=i?0:raw.width-1,y=Math.floor(raw.height/2);assert.ok(raw.data[(y*raw.width+x)*4+3]>0,'closed-wall positive control has edge ink');}
    report.checks.push('open join midpoint alpha zero; closed edge positive control');
  });
  await t.test('unchanged update/idle/local scrolling, texture cache, scene overlays and max12 work budget',async()=>{
    await page.evaluate(async()=>{makeHosts();await wallpaper('grid');await configure({enabled:true,opacity:.5,edgeOnlySurfaces:undefined,surfaceOpenEdges:undefined});});
    const initial=await page.evaluate(()=>counter());await page.evaluate(async()=>{api.update(options);await paint(12);});const settled=await page.evaluate(()=>counter());
    for(const key of ['draws','copies','uploads']) assert.equal(delta(settled,initial,key),0,`${key}: unchanged update and idle`);
    await page.locator('#local').hover();await page.mouse.wheel(0,300);await page.evaluate(()=>paint(6));const scrolled=await page.evaluate(()=>counter());
    for(const key of ['draws','copies','uploads','frames']) assert.equal(delta(scrolled,settled,key),0,`${key}: trusted unrelated local scroll`);
    await page.evaluate(async()=>{document.documentElement.dataset.theme='dark';await configure();});const themed=await page.evaluate(()=>counter());assert.equal(themed.uploads,scrolled.uploads,'theme change is a uniform for image');assert.ok(themed.draws>scrolled.draws);
    await page.evaluate(()=>configure({surfaceBackgrounds:new Map([[hosts[0],{opacity:.6,color:[.2,.3,.4],bounds:{x:100,y:130,width:460,height:260}}]])}));
    const overlay=await page.evaluate(()=>counter());assert.equal(overlay.uploads,themed.uploads);assert.ok(overlay.draws>themed.draws);
    await page.evaluate(()=>configure({surfaceBackgrounds:undefined}));const cleared=await page.evaluate(()=>counter());assert.ok(cleared.draws>overlay.draws,'omitting fresh scene map clears overlay and redraws');
    await page.evaluate(async()=>{makeHosts(13);await configure({enabled:true,opacity:.5});resetWork();for(const host of hosts)host.style.transform='translateX(1px)';api.refreshLayout();await paint();});
    const cap=await page.evaluate(()=>snapshot());assert.equal(cap.canvases.filter(Boolean).length,12);assert.equal(cap.work.contexts,1);assert.equal(cap.work.draws,12);assert.equal(cap.work.copies,12);assert.ok(cap.work.pixels<=12*180000);
    for(const [w,h] of cap.work.viewports)assert.ok(w<=1024&&h<=1024&&w*h<=180000);
    report.checks.push({name:'12-cap',work:cap.work});
  });
  await t.test('safe source, lost/restored context, disabled and disposed lifecycle',async()=>{
    await page.evaluate(async()=>{makeHosts();await wallpaper('transparent');await configure({enabled:true,opacity:.5,surfaceBackgrounds:undefined});});
    assert.ok((await page.evaluate(()=>snapshot())).canvases[0].ink>1000);savePNG('transparent-source',await page.evaluate(()=>raw().png));
    // A CORS-clean but foreign-origin image is still forbidden by the public policy.
    const foreign=`http://localhost:${server.address().port}/foreign.svg`;
    const rejected=await page.evaluate(async src=>{const image=new Image();image.crossOrigin='anonymous';image.src=src;await image.decode();resetWork();api.update({...options,image});await paint();return counter();},foreign);
    assert.deepEqual(rejected.textures.at(-1),[1,1],'foreign source uses tiny safe fallback texture');
    await page.evaluate(()=>configure());const oldDraws=await page.evaluate(()=>work.draws);
    const supported=await page.evaluate(()=>{window.lossExtension=testGL.getExtension('WEBGL_lose_context');lossExtension?.loseContext();return !!lossExtension;});assert.equal(supported,true,'native context loss extension is available');
    await page.waitForFunction(()=>testGL.isContextLost()&&hosts[0].querySelector('[data-sao-liquid]').hidden);
    await page.evaluate(async()=>{await paint(3);lossExtension.restoreContext();});
    await page.waitForFunction(old=>!testGL.isContextLost()&&work.draws>old&&!hosts[0].querySelector('[data-sao-liquid]').hidden,oldDraws,{timeout:10000});
    const restored=await page.evaluate(()=>snapshot());assert.ok(restored.canvases[0].ink>1000);assert.equal(restored.glError,0);assert.equal(restored.work.contexts,1,'restore reuses shared context identity');
    await page.evaluate(()=>configure({enabled:false}));assert.equal(await page.locator('[data-sao-liquid]').count(),0);
    await page.evaluate(()=>configure({enabled:true}));assert.ok((await page.evaluate(()=>snapshot())).canvases[0].ink>1000);
    await page.evaluate(async()=>{api.dispose();await paint();resetWork();window.dispatchEvent(new Event('resize'));await paint();});
    assert.equal(await page.locator('[data-sao-liquid]').count(),0);assert.equal(await page.evaluate(()=>work.draws),0);
    report.checks.push('transparent source; foreign CORS source rejected; native loss/restore; off/re-enable; disposed no work');
  });
  await t.test('DPR2 respects backing cap and native performance measures do not confuse CPU with GPU',async()=>{
    const high=await pageFor('current',2);const frame=await high.evaluate(()=>raw());const scale=Math.min(1.5,Math.sqrt(180000/(460*260)));assert.equal(frame.width,Math.floor(460*scale));assert.equal(frame.height,Math.floor(260*scale));
    savePNG('dpr2-overlay',frame.png);await high.close();
    for(const [variant,target] of [['before',baseline],['current',await pageFor()]]) {
      await target.bringToFront();await target.evaluate(async()=>{document.documentElement.dataset.theme='light';await wallpaper('grid');});
      for(const [count,edgeOnly] of [[1,false],[4,false],[12,false],[1,true]]) {
        const result=await target.evaluate(({count,edgeOnly})=>benchmark(count,edgeOnly),{count,edgeOnly});
        const item={variant,count,edgeOnly,refreshCpuMs:stats(result.cpuRefreshMs),nativeDrawSubmissionCpuMs:result.cpu.drawCpuMs,nativeGLto2DCopyCpuMs:result.cpu.copyCpuMs,work:result.cpu,gpuTimer:{supported:result.timer.supported,elapsedMs:stats(result.timer.milliseconds),droppedDisjoint:result.timer.droppedDisjoint,unavailable:result.timer.unavailable}};
        report.performance.push(item);assert.equal(result.cpu.draws,count*24);assert.equal(result.cpu.copies,count*24);assert.equal(result.cpu.uploads,0);assert.ok(result.cpu.pixels<=count*24*180000);
      }
    }
    report.performanceComparisons=[];
    for(const count of [1,4,12]) for(const edgeOnly of [false,...(count===1?[true]:[])]) {
      const before=report.performance.find(item=>item.variant==='before'&&item.count===count&&item.edgeOnly===edgeOnly), after=report.performance.find(item=>item.variant==='current'&&item.count===count&&item.edgeOnly===edgeOnly);
      // Broad guardrails allow browser/driver scheduling noise; deterministic work budgets above are strict.
      assert.ok(after.refreshCpuMs.median<=before.refreshCpuMs.median*2+1,`${count} hosts: CPU median exceeds 2x baseline +1ms`);
      assert.ok(after.refreshCpuMs.p95<=before.refreshCpuMs.p95*2.5+3,`${count} hosts: CPU p95 exceeds 2.5x baseline +3ms`);
      if(before.gpuTimer.elapsedMs&&after.gpuTimer.elapsedMs) assert.ok(after.gpuTimer.elapsedMs.median<=before.gpuTimer.elapsedMs.median*1.5+.1,`${count} hosts: native GPU median exceeds 1.5x baseline +.1ms`);
      report.performanceComparisons.push({count,edgeOnly,cpuMedianRatio:after.refreshCpuMs.median/Math.max(.001,before.refreshCpuMs.median),gpuMedianRatio:after.gpuTimer.elapsedMs&&before.gpuTimer.elapsedMs?after.gpuTimer.elapsedMs.median/before.gpuTimer.elapsedMs.median:null});
    }
    report.performanceNote='Refresh/draw/copy timings are CPU wall times, including driver synchronization charged to the call. GPU elapsed is only reported from asynchronous non-disjoint native timer queries when supported. No readPixels/getImageData in timed path. Screenshot/readback separate. CPU median <=2x baseline+1ms, p95 <=2.5x baseline+3ms; GPU median <=1.5x baseline+.1ms are broad same-machine guardrails, not portable hardware SLAs. Functional software WebGL is not hardware-performance evidence.';
    report.finalSourceSHA256=sha(fs.readFileSync(currentFile));report.sourceStableThroughoutRun=report.finalSourceSHA256===report.currentSHA256;
  });
});
