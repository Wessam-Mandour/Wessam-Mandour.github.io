/*
 * Guided-walkthrough video recorder.
 * Drives the REAL index.html in Edge (via puppeteer-core), reads section content
 * live from the DOM, animates an eased guided tour with caption callouts and
 * number highlights, and writes deterministic frames for ffmpeg.
 *
 * Re-run after editing the page:  node record.js   (then build.sh stitches frames)
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PAGE = 'file:///C:/Users/845%20g8/Downloads/portfolio/index.html';
const OUT = path.resolve(__dirname, '..', '_frames');
const W = 1280, H = 720, FPS = 30;

const easeInOut = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
const lerp = (a,b,t) => a + (b-a)*t;
const clamp01 = v => Math.max(0, Math.min(1, v));

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const PORT = 9223;
  const profile = path.join(os.tmpdir(), 'edgevid_' + Date.now());
  const edgeProc = spawn(EDGE, [
    '--headless=new','--no-sandbox','--hide-scrollbars','--force-device-scale-factor=1',
    '--no-first-run','--no-default-browser-check','--disable-gpu',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    `--window-size=${W},${H}`, 'about:blank'
  ], { stdio: 'ignore' });

  async function wsEndpoint(){
    for (let i=0;i<80;i++){
      const body = await new Promise(res => {
        http.get(`http://127.0.0.1:${PORT}/json/version`, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); })
            .on('error', ()=>res(null));
      });
      if (body){ try { return JSON.parse(body).webSocketDebuggerUrl; } catch(e){} }
      await new Promise(r=>setTimeout(r,500));
    }
    throw new Error('Edge remote-debugging endpoint never came up');
  }
  const ws = await wsEndpoint();
  const browser = await puppeteer.connect({ browserWSEndpoint: ws, defaultViewport: { width:W, height:H, deviceScaleFactor:1 } });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(PAGE, { waitUntil: 'networkidle0' });

  // Read scenes live from the DOM + inject the overlay/control layer.
  const meta = await page.evaluate(() => {
    // instant scrolling (page uses smooth scroll, which breaks frame-accurate positioning)
    document.documentElement.style.scrollBehavior = 'auto';
    // hide the page's own video block so we don't record a video-in-video
    const vh = document.querySelector('.videohero'); if (vh) vh.style.display = 'none';
    const v = document.querySelector('video'); if (v){ v.pause(); v.removeAttribute('autoplay'); }
    const navH = (document.querySelector('nav')||{}).offsetHeight || 58;

    const order = ['header.hero','#system','#impact','#architecture','#role-matching','#candidate-flow','#config','#writing','#stack'];
    const highlightById = {
      system: '.metrics .n',
      'role-matching': '.projbadge',
      'candidate-flow': '.projbadge'
    };
    const scenes = [];
    for (const sel of order){
      const el = document.querySelector(sel); if (!el) continue;
      const rect = el.getBoundingClientRect();
      const top = Math.max(0, window.scrollY + rect.top - navH - 16);
      const accent = (getComputedStyle(el).getPropertyValue('--accent').trim()) || '#5eead4';
      const eye = (el.querySelector('.eyebrow')||{}).textContent || (sel==='header.hero' ? 'Portfolio' : '');
      const h = (el.querySelector('h1,h2')||{}).textContent || '';
      let sub = (el.querySelector('.lede,.lead')||{}).textContent || '';
      sub = sub.replace(/\s+/g,' ').trim();
      if (sub.length > 118) sub = sub.slice(0,115).trim() + '…';
      scenes.push({ id: el.id||'hero', top, accent, eye: eye.trim(), h: h.trim(), sub,
                    hl: highlightById[el.id] || '' });
    }

    // ---- inject overlay layer ----
    const css = document.createElement('style');
    css.textContent = `
      .vid-hl{transition:transform .3s ease, box-shadow .3s ease;
        transform:scale(1.10); box-shadow:0 0 0 2px var(--vidacc,#5eead4),0 0 30px rgba(94,234,212,.4);
        border-radius:10px; position:relative; z-index:3}
      #vidcap{position:fixed;left:36px;bottom:54px;max-width:780px;z-index:9997;
        opacity:0;transform:translateY(14px);font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
      #vidcap .box{background:rgba(13,17,23,.84);backdrop-filter:blur(6px);
        border:1px solid #2a3240;border-left:4px solid #5eead4;border-radius:12px;padding:15px 22px}
      #vidcap .eye{font-family:ui-monospace,Consolas,monospace;font-size:13px;letter-spacing:.13em;
        text-transform:uppercase;color:#5eead4;margin-bottom:5px}
      #vidcap .h{font-size:27px;font-weight:700;color:#fff;letter-spacing:-.01em;line-height:1.15}
      #vidcap .sub{font-size:14.5px;color:#9aa7b4;margin-top:6px;line-height:1.4}
      #vidover{position:fixed;inset:0;z-index:9999;background:#0d1117;
        display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
        font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
      #vidover .mono{width:90px;height:90px;border:2px solid #5eead4;border-radius:20px;display:flex;
        align-items:center;justify-content:center;font-family:Georgia,serif;font-weight:700;font-size:42px;
        color:#5eead4;margin-bottom:26px}
      #vidover .nm{font-family:Georgia,serif;font-size:48px;font-weight:700;color:#fff}
      #vidover .ti{font-size:21px;color:#5eead4;margin-top:10px}
      #vidover .u{font-family:ui-monospace,Consolas,monospace;font-size:14px;color:#7d8896;margin-top:24px;letter-spacing:.1em}
      #vidflash{position:fixed;inset:0;z-index:9998;background:#0d1117;opacity:0;pointer-events:none}
      #vidprog{position:fixed;left:0;bottom:0;height:3px;width:0;z-index:9999;background:#5eead4}
    `;
    document.head.appendChild(css);

    const cap = document.createElement('div');
    cap.id='vidcap';
    cap.innerHTML = '<div class="box"><div class="eye"></div><div class="h"></div><div class="sub"></div></div>';
    document.body.appendChild(cap);

    const over = document.createElement('div');
    over.id='vidover';
    over.innerHTML = '<div class="mono">WM</div><div class="nm"></div><div class="ti"></div><div class="u"></div>';
    document.body.appendChild(over);

    const flash=document.createElement('div'); flash.id='vidflash'; document.body.appendChild(flash);
    const prog=document.createElement('div'); prog.id='vidprog'; document.body.appendChild(prog);

    let lastHl = [];
    window.__vid = (s) => {
      window.scrollTo(0, s.y);
      // caption
      const c=document.getElementById('vidcap');
      c.style.opacity=s.cap.op; c.style.transform='translateY('+(14*(1-s.cap.op))+'px)';
      if(s.cap.set){
        c.querySelector('.eye').textContent=s.cap.eye;
        c.querySelector('.h').textContent=s.cap.h;
        c.querySelector('.sub').textContent=s.cap.sub;
        c.querySelector('.box').style.borderLeftColor=s.cap.acc;
        c.querySelector('.eye').style.color=s.cap.acc;
        document.documentElement.style.setProperty('--vidacc', s.cap.acc);
      }
      // overlay (intro/outro)
      const o=document.getElementById('vidover');
      o.style.opacity=s.over.op; o.style.display = s.over.op<=0.001 ? 'none':'flex';
      if(s.over.set){ o.querySelector('.nm').textContent=s.over.nm; o.querySelector('.ti').textContent=s.over.ti; o.querySelector('.u').textContent=s.over.u; }
      // flash + progress
      document.getElementById('vidflash').style.opacity=s.flash;
      document.getElementById('vidprog').style.width=(s.prog*100)+'%';
      document.getElementById('vidprog').style.background=s.cap.acc||'#5eead4';
      // highlight
      if(s.hlReset){ lastHl.forEach(e=>e.classList.remove('vid-hl')); lastHl=[]; }
      if(s.hlSel){
        lastHl = Array.from(document.querySelectorAll(s.hlSel));
        lastHl.forEach(e=>e.classList.add('vid-hl'));
      }
    };
    return { navH, scenes };
  });

  const scenes = meta.scenes;

  // ---- build timeline ----
  const INTRO = 2.6, SCROLL = 0.85, HOLD = 2.45, OUTRO = 3.0;
  const segs = [];
  segs.push({ kind:'intro', dur:INTRO });
  let prevTop = 0;
  scenes.forEach((sc, i) => {
    segs.push({ kind:'scroll', dur:SCROLL, from: prevTop, to: sc.top, scene: sc });
    segs.push({ kind:'hold', dur:HOLD, scene: sc, first: i===0 });
    prevTop = sc.top;
  });
  segs.push({ kind:'outro', dur:OUTRO, from: prevTop });

  const total = segs.reduce((a,s)=>a+s.dur,0);
  const totalFrames = Math.round(total*FPS);
  console.log(`scenes=${scenes.length} duration=${total.toFixed(1)}s frames=${totalFrames}`);

  let frame = 0;
  let tAccum = 0;
  for (const seg of segs){
    const segFrames = Math.round(seg.dur*FPS);
    for (let f=0; f<segFrames; f++){
      const lt = f/segFrames;               // local 0..1
      const gp = frame/totalFrames;         // global progress
      const sc = seg.scene || {};
      const acc = sc.accent || '#5eead4';
      let state = {
        y: 0,
        cap: { op:0, set:false, eye:'', h:'', sub:'', acc },
        over: { op:0, set:false },
        flash: 0, prog: gp,
        hlReset:false, hlSel:''
      };

      if (seg.kind==='intro'){
        state.y = scenes[0] ? Math.max(0, scenes[0].top-60) : 0;
        state.over = { op: lt<0.7 ? 1 : 1-easeInOut((lt-0.7)/0.3), set:true,
          nm:'Wessam Mandour', ti:'AI Automations Expert & Technical Writer', u:'A guided walkthrough · wessam-mandour.github.io' };
        state.hlReset = true;
      }
      else if (seg.kind==='scroll'){
        state.y = lerp(seg.from, seg.to, easeInOut(lt));
        state.flash = Math.sin(lt*Math.PI)*0.22;     // subtle dip = transition
        state.cap.op = 0; state.hlReset = true;
      }
      else if (seg.kind==='hold'){
        state.y = sc.top;
        const fin = clamp01(lt/0.18), fout = clamp01((1-lt)/0.16);
        state.cap = { op: Math.min(fin,fout), set:true, eye:sc.eye||'Overview', h:sc.h, sub:sc.sub, acc };
        if (sc.hl && lt>0.12){ state.hlSel = sc.hl; }
      }
      else if (seg.kind==='outro'){
        state.y = seg.from;
        state.over = { op: easeInOut(clamp01(lt/0.4)), set:true,
          nm:'Let’s talk.', ti:'wessam.mandour94@gmail.com', u:'linkedin.com/in/wessam-mandour · github.com/Wessam-Mandour' };
        state.hlReset = true;
      }

      await page.evaluate(s => window.__vid(s), state);
      const name = 'frame-' + String(frame).padStart(5,'0') + '.jpg';
      await page.screenshot({ path: path.join(OUT,name), type:'jpeg', quality:82, captureBeyondViewport:false });
      frame++;
    }
    tAccum += seg.dur;
  }

  console.log('wrote', frame, 'frames to', OUT);
  await browser.disconnect();
  try { edgeProc.kill(); } catch(e){}
  process.exit(0);
})();
