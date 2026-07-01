/*
 * Produced guided-walkthrough recorder.
 * Drives the REAL index.html in Edge, reads section content live from the DOM,
 * and renders a scene-based video: fade-to-black transitions between scenes,
 * a slow camera drift + caption callout per scene, and zoom-pulse highlights
 * on the key numbers / project badges. Frames -> ffmpeg.
 *
 * Re-run after editing the page:  node record.js   (then stitch with ffmpeg)
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

const easeInOut = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
const lerp = (a,b,t) => a + (b-a)*t;
const clamp01 = v => Math.max(0, Math.min(1, v));

(async () => {
  fs.rmSync(OUT, { recursive:true, force:true });
  fs.mkdirSync(OUT, { recursive:true });

  const PORT = 9223;
  const profile = path.join(os.tmpdir(), 'edgevid_' + Date.now());
  const edgeProc = spawn(EDGE, [
    '--headless=new','--no-sandbox','--hide-scrollbars','--force-device-scale-factor=1',
    '--no-first-run','--no-default-browser-check','--disable-gpu',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    `--window-size=${W},${H}`, 'about:blank'
  ], { stdio:'ignore' });

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
  const browser = await puppeteer.connect({ browserWSEndpoint: ws, defaultViewport:{ width:W, height:H, deviceScaleFactor:1 } });
  const page = await browser.newPage();
  await page.setViewport({ width:W, height:H, deviceScaleFactor:1 });
  await page.goto(PAGE, { waitUntil:'networkidle0' });

  const meta = await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const vh = document.querySelector('.videohero'); if (vh) vh.style.display='none';
    const v = document.querySelector('video'); if (v){ v.pause(); v.removeAttribute('autoplay'); }
    const tt = document.getElementById('toTop'); if (tt) tt.style.display='none';
    const navH = (document.querySelector('nav')||{}).offsetHeight || 58;

    const order = ['header.hero','#system','#impact','#architecture','#role-matching','#candidate-flow','#config','#writing','#stack'];
    const hlById = { system:'.metrics .n', 'role-matching':'.projbadge', 'candidate-flow':'.projbadge' };
    const scenes = [];
    for (const sel of order){
      const el = document.querySelector(sel); if (!el) continue;
      let top = Math.max(0, window.scrollY + el.getBoundingClientRect().top - navH - 16);
      // for the System scene, frame the big metric numbers
      if (el.id === 'system'){
        const m = el.querySelector('.metrics');
        if (m) top = Math.max(0, window.scrollY + m.getBoundingClientRect().top - navH - 150);
      }
      const accent = (getComputedStyle(el).getPropertyValue('--accent').trim()) || '#5eead4';
      let eye = (el.querySelector('.eyebrow')||{}).textContent
             || (el.querySelector('.projbadge')||{}).textContent
             || (sel==='header.hero' ? 'Portfolio' : '');
      const h = (el.querySelector('h1,h2')||{}).textContent || '';
      let sub = (el.querySelector('.lede,.lead')||{}).textContent || '';
      sub = sub.replace(/\s+/g,' ').trim(); if (sub.length>120) sub = sub.slice(0,117).trim()+'…';
      scenes.push({ id: el.id||'hero', top, accent, eye: eye.trim(), h: h.trim(), sub, hl: hlById[el.id]||'' });
    }

    const css = document.createElement('style');
    css.textContent = `
      #vidcap{position:fixed;left:46px;bottom:62px;max-width:840px;z-index:9997;opacity:0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
      #vidcap .box{background:rgba(10,14,20,.9);backdrop-filter:blur(8px);border:1px solid #2a3240;border-left:5px solid #5eead4;border-radius:14px;padding:18px 26px;box-shadow:0 18px 50px rgba(0,0,0,.5)}
      #vidcap .eye{font-family:ui-monospace,Consolas,monospace;font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:#5eead4;margin-bottom:7px}
      #vidcap .h{font-size:32px;font-weight:800;color:#fff;letter-spacing:-.01em;line-height:1.12}
      #vidcap .sub{font-size:16px;color:#aab6c2;margin-top:8px;line-height:1.4}
      #vidover{position:fixed;inset:0;z-index:10000;background:#0d1117;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
      #vidover .mono{width:96px;height:96px;border:2px solid #5eead4;border-radius:22px;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-weight:700;font-size:44px;color:#5eead4;margin-bottom:28px;box-shadow:0 0 40px rgba(94,234,212,.25)}
      #vidover .nm{font-family:Georgia,serif;font-size:52px;font-weight:700;color:#fff}
      #vidover .ti{font-size:22px;color:#5eead4;margin-top:12px}
      #vidover .u{font-family:ui-monospace,Consolas,monospace;font-size:15px;color:#7d8896;margin-top:26px;letter-spacing:.1em}
      #vidflash{position:fixed;inset:0;z-index:9999;background:#080b10;opacity:0;pointer-events:none}
      #vidprog{position:fixed;left:0;bottom:0;height:4px;width:0;z-index:10001;background:#5eead4}
    `;
    document.head.appendChild(css);
    const cap=document.createElement('div'); cap.id='vidcap';
    cap.innerHTML='<div class="box"><div class="eye"></div><div class="h"></div><div class="sub"></div></div>';
    document.body.appendChild(cap);
    const over=document.createElement('div'); over.id='vidover';
    over.innerHTML='<div class="mono">WM</div><div class="nm"></div><div class="ti"></div><div class="u"></div>';
    document.body.appendChild(over);
    const flash=document.createElement('div'); flash.id='vidflash'; document.body.appendChild(flash);
    const prog=document.createElement('div'); prog.id='vidprog'; document.body.appendChild(prog);
    // persistent URL watermark (always visible, survives download + re-upload)
    const mark=document.createElement('div');
    mark.innerHTML='<span class="wm">WM</span><span class="u">wes-200.github.io</span>';
    mark.style.cssText='position:fixed;right:26px;bottom:24px;z-index:10002;display:flex;align-items:center;gap:9px;'+
      'background:rgba(10,14,20,.74);backdrop-filter:blur(4px);border:1px solid #2a3240;border-radius:999px;padding:8px 16px 8px 10px';
    mark.querySelector('.wm').style.cssText='width:22px;height:22px;border:1.5px solid #5eead4;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-weight:700;font-size:11px;color:#5eead4';
    mark.querySelector('.u').style.cssText='font-family:ui-monospace,Consolas,monospace;font-size:15px;color:#e6edf3;letter-spacing:.02em';
    document.body.appendChild(mark);

    let hlEls=[];
    window.__vid = (s) => {
      window.scrollTo(0, s.y);
      const c=document.getElementById('vidcap');
      c.style.opacity=s.cap.op; c.style.transform='translateY('+(16*(1-s.cap.op))+'px)';
      if(s.cap.set){
        c.querySelector('.eye').textContent=s.cap.eye;
        c.querySelector('.h').textContent=s.cap.h;
        c.querySelector('.sub').textContent=s.cap.sub;
        c.querySelector('.box').style.borderLeftColor=s.cap.acc;
        c.querySelector('.eye').style.color=s.cap.acc;
      }
      const o=document.getElementById('vidover');
      o.style.opacity=s.over.op; o.style.display=s.over.op<=0.001?'none':'flex';
      if(s.over.set){ o.querySelector('.nm').textContent=s.over.nm; o.querySelector('.ti').textContent=s.over.ti; o.querySelector('.u').textContent=s.over.u; }
      document.getElementById('vidflash').style.opacity=s.flash;
      document.getElementById('vidprog').style.width=(s.prog*100)+'%';
      document.getElementById('vidprog').style.background=s.cap.acc||'#5eead4';
      // highlight pulse (deterministic scale + glow)
      if(s.hlReset){ hlEls.forEach(e=>{e.style.transform='';e.style.boxShadow='';e.style.borderRadius='';e.style.transition='';}); hlEls=[]; }
      if(s.hlSel){
        hlEls = Array.from(document.querySelectorAll(s.hlSel));
        const acc=s.cap.acc||'#5eead4';
        hlEls.forEach(e=>{ e.style.transition='none'; e.style.transformOrigin='center';
          e.style.transform='scale('+s.hlScale.toFixed(3)+')';
          e.style.borderRadius='10px';
          e.style.boxShadow='0 0 0 2px '+acc+', 0 0 '+Math.round(28*s.hlGlow)+'px rgba(94,234,212,'+(0.5*s.hlGlow).toFixed(2)+')';
        });
      }
    };
    return { navH, scenes };
  });

  const scenes = meta.scenes;
  const FI=0.5, FO=0.5, HOLD=2.6, INTRO=2.9, OUTRO=3.3;
  const segs = [{ kind:'intro', dur:INTRO }];
  scenes.forEach(sc => segs.push({ kind:'scene', dur:FI+HOLD+FO, scene:sc }));
  segs.push({ kind:'outro', dur:OUTRO });

  const total = segs.reduce((a,s)=>a+s.dur,0);
  const totalFrames = Math.round(total*FPS);
  console.log(`scenes=${scenes.length} duration=${total.toFixed(1)}s frames=${totalFrames}`);

  let frame = 0;
  for (const seg of segs){
    const segFrames = Math.round(seg.dur*FPS);
    for (let f=0; f<segFrames; f++){
      const ls = (f/segFrames) * seg.dur;     // local seconds
      const gp = frame/totalFrames;
      const sc = seg.scene || {};
      const acc = sc.accent || '#5eead4';
      const st = { y:0, cap:{op:0,set:false,eye:'',h:'',sub:'',acc}, over:{op:0,set:false},
                   flash:0, prog:gp, hlReset:true, hlSel:'', hlScale:1, hlGlow:0 };

      if (seg.kind==='intro'){
        st.y = scenes[0] ? scenes[0].top : 0;
        st.flash = 1;
        const fo = ls > seg.dur-0.5 ? clamp01((ls-(seg.dur-0.5))/0.5) : 0;
        st.over = { op: 1-fo, set:true, nm:'Wessam Mandour',
          ti:'AI Automations Expert & Technical Writer',
          u:'A guided walkthrough · wes-200.github.io' };
      }
      else if (seg.kind==='scene'){
        const drift = 58;
        st.y = sc.top + drift*easeInOut(clamp01(ls/seg.dur));
        st.flash = ls<FI ? (1-ls/FI) : (ls>seg.dur-FO ? (ls-(seg.dur-FO))/FO : 0);
        const capStart=FI+0.12, capEnd=seg.dur-FO-0.05;
        let cop=0;
        if (ls>=capStart && ls<=capEnd){
          cop = Math.min(clamp01((ls-capStart)/0.3), clamp01((capEnd-ls)/0.3));
        }
        st.cap = { op:cop, set:true, eye:sc.eye||'Overview', h:sc.h, sub:sc.sub, acc };
        if (sc.hl && ls>FI+0.1 && ls<seg.dur-FO){
          const p = (ls-FI)/(HOLD);                 // 0..1 through hold
          const pulse = 0.5 + 0.5*Math.sin(p*Math.PI*2*1.6);
          st.hlReset=false; st.hlSel=sc.hl; st.hlScale=1+0.12*pulse; st.hlGlow=0.4+0.6*pulse;
        }
      }
      else if (seg.kind==='outro'){
        st.y = scenes.length ? scenes[scenes.length-1].top : 0;
        st.flash = 1;
        st.over = { op: easeInOut(clamp01(ls/0.5)), set:true, nm:'Let’s talk.',
          ti:'wessam.mandour94@gmail.com',
          u:'linkedin.com/in/wessam-mandour · github.com/Wes-200/Wes-200' };
      }

      await page.evaluate(s => window.__vid(s), st);
      await page.screenshot({ path: path.join(OUT,'frame-'+String(frame).padStart(5,'0')+'.jpg'),
        type:'jpeg', quality:84, captureBeyondViewport:false });
      frame++;
    }
  }

  console.log('wrote', frame, 'frames');
  await browser.disconnect();
  try { edgeProc.kill(); } catch(e){}
  process.exit(0);
})();
