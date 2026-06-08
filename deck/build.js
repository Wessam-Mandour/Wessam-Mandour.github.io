const pptx = new (require("pptxgenjs"))();
pptx.defineLayout({ name: "W", width: 13.333, height: 7.5 });
pptx.layout = "W";

// palette
const BG = "0D1117", PANEL = "161B22", PANEL2 = "1C2330", LINE = "2A3240";
const INK = "E6EDF3", MUTED = "9AA7B4", SOFT = "7D8896";
const TEAL = "5EEAD4", BLUE = "7C9EFF", WARN = "F0B86E";
const MONO = "Consolas", H = "Georgia", BODY = "Calibri";

const W = 13.333, HT = 7.5, M = 0.7;

function bg(s){ s.background = { color: BG }; }
function eyebrow(s, t, x=M, y=0.55){
  s.addText(t.toUpperCase(), { x, y, w:8, h:0.3, fontFace:MONO, fontSize:11,
    color:TEAL, charSpacing:2, align:"left" });
}
function title(s, t, x=M, y=0.9, w=11.9){
  s.addText(t, { x, y, w, h:0.9, fontFace:H, fontSize:34, bold:true, color:INK, align:"left" });
}
function card(s, x, y, w, h, fill=PANEL){
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius:0.08,
    fill:{color:fill}, line:{color:LINE, width:1} });
}
function pill(s, t, x, y, w){
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h:0.42, rectRadius:0.21,
    fill:{color:PANEL}, line:{color:LINE,width:1} });
  s.addText(t, { x, y, w, h:0.42, fontFace:MONO, fontSize:11, color:TEAL, align:"center", valign:"middle" });
}

/* ---------- 1 · TITLE ---------- */
let s = pptx.addSlide(); bg(s);
s.addText("CASE STUDY · AI AUTOMATION & TECHNICAL DOCUMENTATION",
  { x:M, y:1.5, w:11, h:0.3, fontFace:MONO, fontSize:12, color:TEAL, charSpacing:2 });
s.addText("AI Recruiting\nAutomation Platform",
  { x:M, y:2.0, w:11.5, h:2.2, fontFace:H, fontSize:54, bold:true, color:INK, lineSpacingMultiple:0.98 });
s.addText("A DeepSeek matching engine and a 14-service communications pipeline, designed and built from scratch, running unattended in production.",
  { x:M, y:4.25, w:10.4, h:0.8, fontFace:BODY, fontSize:18, color:MUTED });
pill(s, "AI Automations Expert", M, 5.45, 2.85);
pill(s, "Senior Technical Writer", M+3.05, 5.45, 2.85);
pill(s, "DeepSeek · LLM Workflows", M+6.1, 5.45, 3.0);
s.addText("Wessam Mandour", { x:M, y:6.5, w:6, h:0.4, fontFace:MONO, fontSize:14, color:INK, bold:true });

/* ---------- 2 · THE PROBLEM ---------- */
s = pptx.addSlide(); bg(s);
eyebrow(s, "The Problem"); title(s, "Recruiting top-of-funnel doesn't scale by hand");
s.addText("Hundreds of candidates per role. Multi-channel outreach under provider rate caps. Interview transcripts to score. And a final match a recruiter must actually trust.",
  { x:M, y:1.85, w:11.6, h:0.8, fontFace:BODY, fontSize:17, color:MUTED });
const probs = [
  ["Volume", "Hundreds of applicants per role, most not a fit, manual screening is hours of work."],
  ["Rate limits", "Email + WhatsApp outreach must respect provider caps and never double-send."],
  ["Transcripts", "Screening interviews arrive as raw transcripts that need consistent scoring."],
  ["Trust", "A bare match score is useless, a recruiter needs to know WHY a candidate ranked."],
];
probs.forEach((p,i)=>{
  const x = M + (i%2)*5.95, y = 2.95 + Math.floor(i/2)*1.85;
  card(s, x, y, 5.6, 1.6);
  s.addText(p[0], { x:x+0.3, y:y+0.22, w:5, h:0.4, fontFace:H, fontSize:18, bold:true, color:TEAL });
  s.addText(p[1], { x:x+0.3, y:y+0.68, w:5.0, h:0.8, fontFace:BODY, fontSize:13.5, color:MUTED });
});

/* ---------- 3 · SYSTEM OVERVIEW ---------- */
s = pptx.addSlide(); bg(s);
eyebrow(s, "The System"); title(s, "Two systems, one automated funnel");
const sys = [
  ["◆  Matching Engine", "Python · FastAPI · DeepSeek", "Ranks candidates with a written rationale each, through a six-stage funnel. A full run takes 90 to 120 min on Railway and posts Slack status to the team."],
  ["◆  Candidate Flow", "Node · Express · 14 services", "Webhook-triggered automations (CV parse, transcript scoring) plus cron-scheduled reminder sweeps. 2,000+ WhatsApp and email a day; CV parsed in under a minute."],
];
sys.forEach((c,i)=>{
  const x = M + i*5.95; card(s, x, 1.9, 5.6, 2.3);
  s.addText(c[0], { x:x+0.35, y:2.15, w:5, h:0.45, fontFace:H, fontSize:21, bold:true, color:INK });
  s.addText(c[1], { x:x+0.35, y:2.68, w:5, h:0.35, fontFace:MONO, fontSize:12.5, color:TEAL });
  s.addText(c[2], { x:x+0.35, y:3.12, w:5.0, h:1.1, fontFace:BODY, fontSize:14, color:MUTED });
});
const stats = [["40,000","rows scanned / run"],["90-120 min","matching run on Railway"],["2,000+/day","WhatsApp + email"],["<1 min","CV parsed, regex-first"]];
stats.forEach((st,i)=>{
  const x = M + i*2.98; card(s, x, 4.5, 2.75, 1.6, PANEL2);
  s.addText(st[0], { x:x, y:4.74, w:2.75, h:0.65, fontFace:H, fontSize:26, bold:true, color:TEAL, align:"center" });
  s.addText(st[1], { x:x, y:5.48, w:2.75, h:0.4, fontFace:BODY, fontSize:12, color:MUTED, align:"center" });
});
s.addText("Deployed on Railway, triggered by webhooks and cron schedules, with Slack status to the whole team.",
  { x:M, y:6.45, w:11.9, h:0.4, fontFace:BODY, fontSize:13, italic:true, color:SOFT, align:"center" });

/* ---------- 4 · ARCHITECTURE ---------- */
s = pptx.addSlide(); bg(s);
eyebrow(s, "Architecture"); title(s, "Event-driven, with the workspace as source of truth");
function flowBox(x,y,w,h,t,sub,accent){
  s.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:0.06,fill:{color:accent?PANEL2:PANEL},line:{color:accent?TEAL:LINE,width:accent?1.5:1}});
  s.addText(t,{x,y:y+(sub?0.12:0),w,h:sub?0.4:h,fontFace:BODY,fontSize:14,bold:true,color:INK,align:"center",valign:sub?"top":"middle"});
  if(sub) s.addText(sub,{x,y:y+0.52,w,h:0.3,fontFace:MONO,fontSize:10,color:SOFT,align:"center"});
}
function arrow(x1,y1,x2,y2,color=TEAL){
  s.addShape(pptx.ShapeType.line,{x:x1,y:y1,w:x2-x1,h:y2-y1,line:{color,width:1.75,endArrowType:"triangle"}});
}
flowBox(M, 3.0, 2.5, 1.3, "Notion\nWorkspace", "webhook source", true);
flowBox(4.2, 2.05, 3.0, 1.0, "Candidate Flow", "14 services", false);
flowBox(4.2, 3.45, 3.0, 1.0, "Matching Engine", "queue → 6 stages", false);
flowBox(8.3, 2.05, 2.1, 1.0, "Email · WhatsApp\nCV · transcripts", null, false);
flowBox(8.3, 3.45, 2.1, 1.0, "LLM scoring\n(DeepSeek)", null, false);
flowBox(11.0, 2.7, 1.7, 1.6, "Ranked\nshortlist\n+ rationale", null, true);
arrow(2.5, 3.3, 4.2, 2.55);
arrow(2.5, 3.5, 4.2, 3.95);
arrow(7.2, 2.55, 8.3, 2.55);
arrow(7.2, 3.95, 8.3, 3.95);
arrow(10.4, 3.5, 11.0, 3.5);
// write-back dashed
s.addShape(pptx.ShapeType.line,{x:1.95,y:4.3,w:0,h:1.0,line:{color:SOFT,width:1.25,dashType:"dash"}});
s.addShape(pptx.ShapeType.line,{x:1.95,y:5.3,w:9.9,h:0,line:{color:SOFT,width:1.25,dashType:"dash"}});
s.addShape(pptx.ShapeType.line,{x:11.85,y:5.3,w:0,h:-0.95,line:{color:SOFT,width:1.25,dashType:"dash",endArrowType:"triangle"}});
s.addText("writes results back → workspace", {x:4.5, y:5.32, w:5, h:0.3, fontFace:MONO, fontSize:10, color:SOFT});
const princ = "No shared database to corrupt  ·  failure in one service can't block another  ·  every service stateless & idempotent";
s.addText(princ, {x:M, y:6.2, w:11.9, h:0.5, fontFace:BODY, fontSize:14, color:MUTED, align:"center"});

/* ---------- 5 · MATCHING FUNNEL ---------- */
s = pptx.addSlide(); bg(s);
eyebrow(s, "Deep Dive · Matching Engine"); title(s, "Six stages: job description → ranked shortlist");
s.addText("Each stage narrows the pool before the next, more expensive stage runs. The LLM only sees candidates worth paying to score.",
  { x:M, y:1.8, w:11.7, h:0.5, fontFace:BODY, fontSize:15, italic:true, color:MUTED });
const stages = [
  ["1","Rubric extraction","LLM turns free-text job spec into a structured rubric: gates, requirements, keywords."],
  ["2","Keyword reduction","Cheap local filter drops no-signal candidates BEFORE any paid LLM call, top cost lever."],
  ["3","Hard filters","Non-negotiable gates: language, location, minimum screening score."],
  ["4","Priority ordering","Bucket by business priority; score the highest-value candidates first."],
  ["5","LLM scoring","0-100 + written rationale each, concurrency-capped, retried, failure-isolated."],
  ["6","Qualify & backfill","Link qualified first; backfill best below-threshold to hit target, logged."],
];
stages.forEach((st,i)=>{
  const x = M + (i%2)*5.95, y = 2.5 + Math.floor(i/2)*1.45;
  card(s, x, y, 5.6, 1.25);
  s.addShape(pptx.ShapeType.roundRect,{x:x+0.25,y:y+0.3,w:0.65,h:0.65,rectRadius:0.08,fill:{color:PANEL2},line:{color:LINE,width:1}});
  s.addText(st[0],{x:x+0.25,y:y+0.3,w:0.65,h:0.65,fontFace:H,fontSize:22,bold:true,color:TEAL,align:"center",valign:"middle"});
  s.addText(st[1],{x:x+1.1,y:y+0.18,w:4.3,h:0.4,fontFace:H,fontSize:16,bold:true,color:INK});
  s.addText(st[2],{x:x+1.1,y:y+0.58,w:4.35,h:0.6,fontFace:BODY,fontSize:12.5,color:MUTED});
});

/* ---------- 6 · ENGINEERING ---------- */
s = pptx.addSlide(); bg(s);
eyebrow(s, "Under the Hood"); title(s, "The parts that make it production, not a script");
const eng = [
  ["↻","Idempotent re-runs","Scored records skipped on re-run, no double-contact, no duplicate matches."],
  ["⏱","Rate limiting","Sequential queue, concurrency cap, write delays, under quota by design."],
  ["⤾","Graceful degradation","Backoff + JSON hardening; one bad candidate can't sink a 200-candidate run."],
  ["⛨","Schema-drift defense","Missing props ignored, odd types logged & skipped, eligibility re-checked."],
  ["$","AI only where needed","DeepSeek for judgment; regex for parsing, filtering, routing. No wasted tokens."],
  ["⌗","Observability + Slack","Logs keyed by id, email, stage; Slack status to the team at start and finish."],
];
eng.forEach((e,i)=>{
  const x = M + (i%3)*3.98, y = 2.0 + Math.floor(i/3)*2.1;
  card(s, x, y, 3.7, 1.85);
  s.addShape(pptx.ShapeType.ellipse,{x:x+0.3,y:y+0.28,w:0.55,h:0.55,fill:{color:PANEL2},line:{color:TEAL,width:1.25}});
  s.addText(e[0],{x:x+0.3,y:y+0.28,w:0.55,h:0.55,fontFace:BODY,fontSize:18,color:TEAL,align:"center",valign:"middle"});
  s.addText(e[1],{x:x+0.3,y:y+0.95,w:3.2,h:0.4,fontFace:H,fontSize:15,bold:true,color:INK});
  s.addText(e[2],{x:x+0.3,y:y+1.32,w:3.2,h:0.5,fontFace:BODY,fontSize:12,color:MUTED});
});

/* ---------- 6b · CONFIGURABILITY ---------- */
s = pptx.addSlide(); bg(s);
eyebrow(s, "Configurable by Design"); title(s, "One codebase, many deployments, zero forks");
s.addText("Nothing is hard-coded per client. Behavior is driven entirely by environment variables, so the same service is deployed many times, each tuned to a different goal, by changing config and redeploying.",
  { x:M, y:1.8, w:11.9, h:0.7, fontFace:BODY, fontSize:15, italic:true, color:MUTED });
const cfg = [
  ["Same engine, Flash or Pro","One codebase, two deployments: DeepSeek Flash for speed and cost, DeepSeek Pro for tougher roles. A single env var picks the model."],
  ["One reminder, deployed 3×","The WhatsApp reminder service runs three times, each with a different \"hours since submission\" threshold, for a staggered reminder sequence."],
  ["Same code, new database","Each branch points at a different Notion database in the same workspace via env vars. New database, new deploy, no code change."],
];
cfg.forEach((c,i)=>{
  const x = M + i*3.98; card(s, x, 2.7, 3.7, 2.7, PANEL2);
  s.addText(c[0],{x:x+0.3,y:3.0,w:3.1,h:0.7,fontFace:H,fontSize:16,bold:true,color:TEAL});
  s.addText(c[1],{x:x+0.3,y:3.75,w:3.1,h:1.5,fontFace:BODY,fontSize:13,color:MUTED});
});
s.addText("Same automation, different database, setting, or timeframe? Redeployed to a new space in about 5 minutes.",
  { x:M, y:5.75, w:11.9, h:0.4, fontFace:BODY, fontSize:13, italic:true, color:SOFT, align:"center" });

/* ---------- 7 · DOCUMENTATION ---------- */
s = pptx.addSlide(); bg(s);
eyebrow(s, "Technical Writing"); title(s, "The documentation is part of the deliverable");
s.addText("Every service ships an operational handbook. For a system that runs unattended, the docs are the reliability layer.",
  { x:M, y:1.85, w:5.4, h:1.0, fontFace:BODY, fontSize:16, color:MUTED });
const docpts = [
  ["Audience-layered","One-table overview for managers, branch-level depth for developers, same doc."],
  ["Operational","Documents which log line proves which behavior: debug by grep, not by reading source."],
  ["Failure-first","Maps real symptoms to the exact gate that caused them."],
];
docpts.forEach((d,i)=>{
  const y = 3.05 + i*1.15; card(s, M, y, 5.5, 1.0);
  s.addText(d[0],{x:M+0.3,y:y+0.13,w:5,h:0.35,fontFace:H,fontSize:15,bold:true,color:TEAL});
  s.addText(d[1],{x:M+0.3,y:y+0.5,w:5,h:0.45,fontFace:BODY,fontSize:12.5,color:MUTED});
});
// terminal card
const tx = 6.6, tw = 6.05;
card(s, tx, 1.85, tw, 4.9, "0A0E14");
["E06C75","E5C07B","98C379"].forEach((c,i)=>s.addShape(pptx.ShapeType.ellipse,{x:tx+0.3+i*0.32,y:2.1,w:0.16,h:0.16,fill:{color:c}}));
s.addText("troubleshooting.md", {x:tx+1.4,y:2.05,w:4,h:0.3,fontFace:MONO,fontSize:11,color:SOFT});
const term = [
  { text:"## Troubleshooting\n\n", options:{color:SOFT} },
  { text:"Candidate not considered for a role, check, in order:\n", options:{color:TEAL,bold:true} },
  { text:"  1. Stage-2 keyword overlap\n  2. Stage-3 hard filters (language, location, score)\n  3. existing scored row (already processed)\n  4. duplicate-email de-duplication\n\n", options:{color:INK} },
  { text:"Fewer qualified matches than target, expected:\n", options:{color:TEAL,bold:true} },
  { text:"  Stage 6 backfills below-threshold by descending\n  score and logs ", options:{color:INK} },
  { text:"fallback_selected=true", options:{color:WARN} },
  { text:" per row.", options:{color:INK} },
];
s.addText(term, {x:tx+0.35, y:2.55, w:tw-0.7, h:4.0, fontFace:MONO, fontSize:12, lineSpacingMultiple:1.15, valign:"top" });

/* ---------- 8 · IMPACT ---------- */
s = pptx.addSlide(); bg(s);
eyebrow(s, "Impact"); title(s, "What the automation delivers");
const imp = [["40,000","candidate rows scanned per matching run"],["90-120 min","full run on Railway, with Slack status"],["2,000+/day","WhatsApp + emails (Twilio + Postmark)"],["<1 min","to parse a CV, regex-first, AI only when needed"]];
imp.forEach((m,i)=>{
  const x = M + (i%2)*5.95, y = 2.1 + Math.floor(i/2)*2.15;
  card(s, x, y, 5.6, 1.9, PANEL2);
  s.addText(m[0],{x:x+0.4,y:y+0.32,w:5,h:0.9,fontFace:H,fontSize:38,bold:true,color:TEAL});
  s.addText(m[1],{x:x+0.42,y:y+1.25,w:4.95,h:0.5,fontFace:BODY,fontSize:14,color:MUTED});
});
s.addText("Manual work that took weeks, now seconds to a couple of hours. Workflow on the previous slides.",
  { x:M, y:6.5, w:11.9, h:0.4, fontFace:BODY, fontSize:13, italic:true, color:SOFT, align:"center" });

/* ---------- 9 · CLOSING ---------- */
s = pptx.addSlide(); bg(s);
s.addText("WHAT THIS DEMONSTRATES", {x:M,y:1.2,w:11,h:0.3,fontFace:MONO,fontSize:12,color:TEAL,charSpacing:2});
const sig = [
  ["AI automation","14 event-driven services, idempotent, rate-limited, running unattended in production."],
  ["Technical writing","Audience-layered operational handbooks, failure-first troubleshooting, this case study."],
  ["Cost-aware AI","DeepSeek on judgment-heavy steps, regex everywhere else. No wasted tokens."],
];
sig.forEach((g,i)=>{
  const y = 1.85 + i*1.25;
  s.addShape(pptx.ShapeType.roundRect,{x:M,y,w:0.12,h:1.0,rectRadius:0.06,fill:{color:TEAL},line:{type:"none"}});
  s.addText(g[0],{x:M+0.4,y:y+0.02,w:4,h:0.45,fontFace:H,fontSize:21,bold:true,color:INK});
  s.addText(g[1],{x:M+0.4,y:y+0.5,w:10.5,h:0.6,fontFace:BODY,fontSize:15,color:MUTED});
});
s.addText("Wessam Mandour", {x:M,y:6.0,w:7,h:0.5,fontFace:H,fontSize:22,bold:true,color:INK});
s.addText("wessam.mandour94@gmail.com   ·   linkedin.com/in/wessam-mandour   ·   github.com/Wessam-Mandour",
  {x:M,y:6.55,w:12,h:0.4,fontFace:MONO,fontSize:13,color:MUTED});

pptx.writeFile({ fileName: "AI-Recruiting-Automation-Portfolio.pptx" }).then(f=>console.log("Wrote",f));
