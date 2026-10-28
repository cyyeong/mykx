#!/usr/bin/env python3
# Design boards for the founder's 29 Oct batch (canvas page "Admin and sign-in, 29 Oct").
import os, html

S = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(S, "canvas-root", "project")
B = {
    "city": "f3fd52715c2e2bb9ef9c063b0011465a", "doorL": "9c763bd90b5c79dc3a1785d6edbe12c1", "doorR": "d33aa23a3dbd8b858357dfcaaca61238",
    "terr": "42a1d142037c7463131ff440b4e5f999", "kixT": "bb08e7ec23418f8b39ef9322df1f30f6", "kix": "edfd9859b1135de333b54095f6c8d1b6",
    "home": "d9e74b6cfd4c6545c846a803a120ecc7", "wmDark": "86d2ad40444eabc4ba4c8a0e9f1d4603", "wmLight": "f52e18857979369421011da66fdb9de3",
    "idle": "02f791d67e720a2bf4fdb268ff6b6b8a", "pilot": "f2b604acfbcb01359f6fc041e9c051b4", "cheer": "f506e58a602297834bce49cc9565bca7",
}
img = lambda k: f"/_blob/{B[k]}"
SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;fill:currentColor;flex:none"><path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z"/></svg>'
LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:13px;height:13px;flex:none"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3"/></svg>'

def board(name, title, w, h, theme, body, css):
    doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{html.escape(title)}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="ds/mykx/tokens.css">
<link rel="stylesheet" href="ds/mykx/components/bundle.css">
</head>
<body>
<x-dc>
<helmet>
<style>body{{margin:0}} .bd{{width:{w}px;height:{h}px;position:relative;overflow:hidden;box-sizing:border-box;font-family:var(--font-text);background:var(--surface);color:var(--ink)}} .bd *{{box-sizing:border-box}} .bd h1,.bd h2,.bd h3,.bd p{{margin:0}}
{css}</style>
</helmet>
<div class="bd" data-theme="{theme}">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""
    open(os.path.join(OUT, f"{name}.dc.html"), "w").write(doc)

# ---------------------------------------------------------------------------------------------------------------------
# 1. Magic name sign-in storyboard (1280x800): four frames, the third one alive.
mn_css = """
.mn-head{position:absolute;left:40px;top:28px;right:40px;display:flex;justify-content:space-between;align-items:flex-end}
.mn-head h1{font:600 30px/36px var(--font-display);color:#fff}
.mn-head p{font:700 15px/22px var(--font-text);color:#D9D3FF;max-width:560px;text-align:right}
.bd{background:#16143E}
.mn-grid{position:absolute;left:40px;right:40px;top:104px;bottom:28px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:18px}
.mn-f{position:relative;border-radius:22px;overflow:hidden;background:#000;box-shadow:0 0 0 1px rgba(185,167,245,.3)}
.mn-f > img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.mn-cap{position:absolute;left:14px;top:12px;z-index:9;display:flex;align-items:center;gap:8px;padding:5px 12px 5px 6px;border-radius:999px;background:rgba(22,20,62,.78);color:#fff;font:800 14px/18px var(--font-text)}
.mn-cap b{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#FFE38A;color:#1C1B4A;font:800 13px/1 var(--font-text)}
.mn-card{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:400px;padding:16px 18px;border-radius:24px;background:rgba(255,255,255,.94);box-shadow:0 18px 40px rgba(10,8,40,.35)}
.mn-card h3{font:600 20px/26px var(--font-display);color:#1B2350}
.mn-row{display:flex;gap:8px;margin-top:10px}
.mn-in{flex:1;height:40px;border-radius:12px;box-shadow:inset 0 0 0 2px #D8D3F5;padding:0 12px;display:flex;align-items:center;color:#8C87C4;font:700 14px var(--font-text)}
.mn-btn{height:40px;padding:0 16px;border-radius:999px;background:#1F66C1;color:#fff;display:flex;align-items:center;font:800 14px var(--font-text)}
.mn-kids{margin-top:12px;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:18px;background:linear-gradient(120deg,#2B2A5C,#3D2F7A);color:#fff;cursor:pointer;box-shadow:0 0 0 2px rgba(255,227,138,.6),0 0 22px rgba(255,227,138,.35)}
.mn-kids img{width:44px;height:44px;border-radius:50%;object-fit:cover;flex:none;background:#B9A7F5}
.mn-kids p{font:700 14px/19px var(--font-text)}
.mn-kids p b{color:#FFE38A;font-weight:800}
.mn-bubble{position:absolute;left:50%;top:50%;transform:translate(-50%,-46%);width:420px;padding:18px 20px 16px;border-radius:26px 26px 26px 8px;background:#fff;box-shadow:0 0 0 3px #FFE38A,0 24px 60px rgba(10,8,40,.5)}
.mn-bubble .who{display:flex;align-items:center;gap:10px}
.mn-bubble .who img{width:52px;height:52px;border-radius:50%;object-fit:cover;background:#EEF5E4}
.mn-bubble .who p{font:600 18px/24px var(--font-display);color:#2B2A5C}
.mn-name{margin-top:14px;height:56px;border-radius:16px;box-shadow:inset 0 0 0 3px #7C5CFF;padding:0 16px;display:flex;align-items:center;justify-content:space-between;font:700 22px var(--font-display);color:#2B2A5C}
.mn-name i{width:2px;height:28px;background:#7C5CFF;animation:mn-caret 1s steps(1) infinite}
.mn-cont{margin-top:12px;height:52px;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(90deg,#7C5CFF,#FF7EB6);color:#fff;font:800 18px var(--font-text);box-shadow:0 8px 22px rgba(124,92,255,.45)}
.mn-hint{margin-top:8px;font:700 12px/16px var(--font-text);color:#6C66B0;text-align:center}
.mn-dim{position:absolute;inset:0;background:rgba(14,11,46,.55);backdrop-filter:blur(2px)}
/* frame 3: alive */
.mn-morph{position:absolute;inset:0;animation:mn-morph 6s ease-in-out infinite}
.mn-door{position:absolute;left:50%;top:50%;width:150px;height:280px;margin:-140px 0 0 -75px;display:flex;animation:mn-fly 6s cubic-bezier(.2,.8,.2,1) infinite;filter:drop-shadow(0 0 18px rgba(255,227,138,.85))}
.mn-door img{width:50%;height:100%;object-fit:cover}
.mn-trail{position:absolute;left:62%;top:8%;width:320px;height:6px;border-radius:6px;background:linear-gradient(90deg,rgba(255,227,138,0),rgba(255,227,138,.95));transform:rotate(152deg);transform-origin:0 50%;animation:mn-trail 6s ease-out infinite}
.mn-mote{position:absolute;width:8px;height:8px;border-radius:50%;background:#FFF6B8;box-shadow:0 0 10px 3px rgba(255,227,138,.8);animation:mn-mote 3.6s ease-in-out infinite}
.mn-leaf{position:absolute;width:22px;height:12px;border-radius:12px 0;background:#5FBF6E;animation:mn-leaf 4.8s linear infinite;opacity:.9}
.mn-say{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:8px 16px;border-radius:999px;background:rgba(22,20,62,.8);color:#FFE38A;font:800 14px var(--font-text);white-space:nowrap}
/* frame 4 */
.mn-door4{position:absolute;left:50%;top:44px;width:170px;height:300px;margin-left:-85px;display:flex;filter:drop-shadow(0 0 16px rgba(255,227,138,.7))}
.mn-door4 img{width:50%;height:100%;object-fit:cover}
.mn-pad{position:absolute;right:26px;top:70px;width:236px;padding:14px;border-radius:22px;background:rgba(255,255,255,.95);box-shadow:0 16px 40px rgba(10,8,40,.4)}
.mn-pad h3{font:600 18px/22px var(--font-display);color:#1D3324}
.mn-pad p{font:700 12px/16px var(--font-text);color:#3F6B4C;margin-top:2px}
.mn-slots{display:flex;gap:8px;margin:10px 0}
.mn-slots span{width:20px;height:20px;border-radius:50%;box-shadow:inset 0 0 0 2.5px #9DBF9F}
.mn-slots span.on{background:#2C7A47;box-shadow:none}
.mn-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mn-tiles i{display:block;aspect-ratio:1;border-radius:50%;background:#EEF5E4 center/cover}
@keyframes mn-caret{50%{opacity:0}}
@keyframes mn-morph{0%,18%{opacity:0}45%,100%{opacity:1}}
@keyframes mn-fly{0%{transform:translate(380px,-260px) scale(.18) rotate(-24deg);opacity:0}12%{opacity:1}55%{transform:translate(-20px,10px) scale(1.06) rotate(4deg)}68%{transform:translate(0,0) scale(.98) rotate(-2deg)}78%,100%{transform:translate(0,0) scale(1) rotate(0)}}
@keyframes mn-trail{0%,8%{opacity:0;width:0}30%{opacity:1;width:320px}60%,100%{opacity:0;width:420px}}
@keyframes mn-mote{0%,100%{transform:translateY(0);opacity:.3}50%{transform:translateY(-26px);opacity:1}}
@keyframes mn-leaf{0%{transform:translate(0,-30px) rotate(0)}100%{transform:translate(-120px,420px) rotate(540deg)}}
@media (prefers-reduced-motion: reduce){.mn-door,.mn-morph,.mn-trail,.mn-mote,.mn-leaf{animation:none}.mn-morph{opacity:1}}
"""
motes = "".join(f'<i class="mn-mote" style="left:{x}%;top:{y}%;animation-delay:-{d}s"></i>' for x, y, d in [(14, 60, 0), (24, 30, 1.1), (70, 22, 2.2), (82, 64, .6), (46, 18, 1.7), (60, 74, 2.9)])
leaves = "".join(f'<i class="mn-leaf" style="left:{x}%;top:-4%;animation-delay:-{d}s"></i>' for x, d in [(30, 0), (58, 1.6), (78, 3.1), (90, .8)])
card = f"""<div class="mn-card"><h3>Welcome back</h3><div class="mn-row"><span class="mn-in">Email</span><span class="mn-in">Password</span><span class="mn-btn">Open</span></div>
<div class="mn-kids"><img src="{img('kix')}" alt=""><p><b>Kids:</b> tell me your magic name, and I shall bring your magical door</p></div></div>"""
mn = f"""
<div class="mn-head"><h1>Kids' magic name: the door comes to you</h1><p>No email for kids: a unique magic name the parent sets, then the child's own door flies in and their world replaces the city. Then the picture code or password, then the tunnel.</p></div>
<div class="mn-grid">
  <div class="mn-f"><img class="bg" src="{img('city')}" alt=""><span class="mn-cap"><b>1</b>The kids' line is a little dialogue with Kix</span>{card}</div>
  <div class="mn-f"><img class="bg" src="{img('city')}" alt=""><div class="mn-dim"></div><span class="mn-cap"><b>2</b>Tap it: Kix asks for the magic name</span>
    <div class="mn-bubble"><div class="who"><img src="{img('kix')}" alt=""><p>Tell me your magic name, and I shall bring your magical door!</p></div><div class="mn-name">starry-jordan<i></i></div><div class="mn-cont">{SPARK}Bring my door</div><p class="mn-hint">Your grown-up set your magic name. Forgot it? Ask them, or use Kids' doors on their phone.</p></div></div>
  <div class="mn-f"><img class="bg" src="{img('city')}" alt=""><div class="mn-morph"><img class="bg" src="{img('terr')}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></div>{leaves}{motes}<i class="mn-trail"></i>
    <div class="mn-door"><img src="{img('doorL')}" alt=""><img src="{img('doorR')}" alt=""></div><span class="mn-cap"><b>3</b>Continue: Jordan's door flies in as the terrarium grows over the city</span><span class="mn-say">Here it comes, Jordan!</span></div>
  <div class="mn-f"><img class="bg" src="{img('terr')}" alt="">{motes}<span class="mn-cap"><b>4</b>The door waits: picture code, then the time tunnel</span>
    <div class="mn-door4"><img src="{img('doorL')}" alt=""><img src="{img('doorR')}" alt=""></div>
    <div class="mn-pad"><h3>Hello, Jordan!</h3><p>Tap your four pictures</p><div class="mn-slots"><span class="on"></span><span class="on"></span><span></span><span></span></div><div class="mn-tiles">{''.join(f'<i style="background-image:url({img(k)})"></i>' for k in ['idle','cheer','pilot','kixT','idle','cheer'])}</div></div></div>
</div>
"""
board("KidMagicName", "Kids' magic name sign-in", 1280, 800, "dreamlight", mn, mn_css)

# ---------------------------------------------------------------------------------------------------------------------
# 2. Kid sign-out and the idle card (1280x800)
so_css = """
.bd{background:#0E0B2E}
.so-shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.9)}
.so-dim{position:absolute;inset:0;background:rgba(14,11,46,.45)}
.so-menu{position:absolute;right:28px;top:76px;width:280px;padding:10px;border-radius:22px;background:#fff;box-shadow:0 20px 50px rgba(10,8,40,.45)}
.so-menu a{display:flex;align-items:center;gap:10px;min-height:52px;padding:0 14px;border-radius:14px;color:#1D3324;font:800 17px var(--font-text);text-decoration:none}
.so-menu a.out{background:#FFF1E8;color:#9A3A12;box-shadow:inset 0 0 0 2px #F6C8AE;margin-top:6px}
.so-menu svg{width:20px;height:20px}
.so-idle{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:440px;padding:26px 28px 24px;border-radius:30px;background:#fff;text-align:center;box-shadow:0 0 0 4px #FFE38A,0 30px 80px rgba(10,8,40,.6)}
.so-idle img{width:120px;height:120px;border-radius:50%;object-fit:cover;background:#EEF5E4;margin:0 auto}
.so-idle h2{margin-top:10px;font:600 30px/36px var(--font-display);color:#1D3324}
.so-idle p{margin-top:6px;font:700 17px/25px var(--font-text);color:#3F6B4C}
.so-ring{width:92px;height:92px;margin:14px auto 0;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#2C7A47 0 72%,#E3EEDB 72% 100%);font:600 24px var(--font-display);color:#1D3324}
.so-ring span{display:grid;place-items:center;width:72px;height:72px;border-radius:50%;background:#fff}
.so-btns{display:flex;gap:10px;margin-top:16px}
.so-btns span{flex:1;min-height:56px;border-radius:999px;display:flex;align-items:center;justify-content:center;font:800 18px var(--font-text)}
.so-here{background:#2C7A47;color:#fff}
.so-now{box-shadow:inset 0 0 0 2.5px #2C7A47;color:#1D3324}
.so-note{position:absolute;left:28px;bottom:24px;width:420px;padding:14px 16px;border-radius:18px;background:rgba(22,20,62,.85);color:#E4DFFF;font:700 14px/20px var(--font-text)}
.so-note b{color:#FFE38A}
"""
so = f"""
<img class="so-shot" src="{img('home')}" alt="Jordan's home in myKx"><div class="so-dim"></div>
<div class="so-menu"><a>{SPARK} What my grown-ups see</a><a>{SPARK} My Kix and my world</a><a class="out"><svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/></svg>Sign out</a></div>
<div class="so-idle"><img src="{img('idle')}" alt=""><h2>Still there, Jordan?</h2><p>Kix will sign you out soon so nobody else can use your account.</p><div class="so-ring"><span>0:52</span></div><div class="so-btns"><span class="so-here">I'm here!</span><span class="so-now">Sign out now</span></div></div>
<p class="so-note"><b>Rule:</b> any tap, key or scroll resets the clock. At 14 minutes idle this card appears; at 15 the kid is signed out and the door closes. Sign out is always in the kid's menu.</p>
"""
board("KidSignOut", "Kids sign out and the idle card", 1280, 800, "terrarium", so, so_css)

# ---------------------------------------------------------------------------------------------------------------------
# Shared admin shell (anime-sky tokens, like the existing admin boards)
ad_css = """
.bd{background:var(--surface)}
.ad-nav{position:absolute;left:0;top:0;bottom:0;width:220px;padding:22px 14px;box-shadow:inset -1px 0 0 var(--line);display:flex;flex-direction:column;gap:4px}
.ad-nav img{height:30px;align-self:flex-start;margin:0 8px 16px}
.ad-nav a{display:block;padding:9px 12px;border-radius:12px;color:var(--ink-muted);font:700 14px var(--font-text)}
.ad-nav a.on{background:var(--surface-raised);color:var(--ink);box-shadow:inset 3px 0 0 var(--accent)}
.ad-main{position:absolute;left:220px;right:0;top:0;bottom:0;padding:24px 28px}
.ad-h1{font:800 26px/32px var(--font-display)}
.ad-sub{margin-top:4px;font:600 14px/20px var(--font-text);color:var(--ink-muted)}
.chip{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;font:800 12px/1 var(--font-text);white-space:nowrap}
.c-pub{background:#DDF3E4;color:#1F5E37}.c-draft{background:#FFF1D6;color:#8A5A00}.c-def{background:#E8E6F7;color:#3B3780}.c-flag{background:#FFE3E3;color:#A21C1C}.c-warn{background:#FFF1D6;color:#8A5A00}.c-ok{background:#DDF3E4;color:#1F5E37}.c-muse{background:#B9A7F5;color:#1C1B4A}.c-over{background:#1F66C1;color:#fff}
.btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:999px;font:800 13px var(--font-text);white-space:nowrap}
.b-pri{background:var(--accent);color:var(--on-accent)}.b-sec{box-shadow:inset 0 0 0 2px var(--line);color:var(--ink)}.b-muse{background:#2B2A5C;color:#fff}.b-del{color:#A21C1C;box-shadow:inset 0 0 0 2px #F3C4C4}
.card{border-radius:20px;background:var(--surface-raised);box-shadow:inset 0 0 0 1px var(--line);padding:16px}
.h2{font:800 16px/22px var(--font-display)}
.mono{font:500 12.5px/20px ui-monospace,SFMono-Regular,Menlo,monospace}
.diff-add{background:#E6F6EA;color:#1F5E37;display:block;padding:0 8px}.diff-del{background:#FDE8E8;color:#A21C1C;display:block;padding:0 8px;text-decoration:line-through}.diff-ctx{display:block;padding:0 8px;color:var(--ink-muted)}
.vrow{display:grid;grid-template-columns:70px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}
.vrow b{font:800 14px var(--font-text)}
.vrow small{display:block;font:600 12px/16px var(--font-text);color:var(--ink-muted)}
.acts{display:flex;gap:6px}
"""
NAV = lambda on: f'<nav class="ad-nav"><img src="{img("wmLight")}" alt="myKx">' + "".join(f'<a class="{"on" if n == on else ""}">{n}</a>' for n in ["Skills", "Add knowledge", "People", "Under the hood"]) + "</nav>"

# 3. Skill editor (1440x900)
se_css = ad_css + """
.se-top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.se-tools{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.se-grid{position:absolute;left:28px;right:28px;top:118px;bottom:24px;display:grid;grid-template-columns:230px minmax(0,1fr) 380px;gap:16px}
.se-files a{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:10px;font:700 13px var(--font-text);color:var(--ink)}
.se-files a.on{background:var(--surface);box-shadow:inset 0 0 0 2px var(--accent)}
.se-files small{font:600 11px var(--font-text);color:var(--ink-muted)}
.se-files h3{font:800 12px var(--font-text);color:var(--ink-muted);margin:10px 10px 4px}
.se-ed{display:flex;flex-direction:column;gap:10px}
.se-text{flex:1;min-height:0;border-radius:14px;background:#0F1430;color:#DCE3FF;padding:14px 16px;overflow:hidden}
.se-text .k{color:#8CCBFF}.se-text .h{color:#FFE38A}
.se-side{display:flex;flex-direction:column;gap:12px;min-height:0}
.se-ask{border-radius:14px;box-shadow:inset 0 0 0 2px #B9A7F5;padding:10px 12px;font:600 13px/19px var(--font-text);color:var(--ink);min-height:74px;background:var(--surface)}
.se-prop li{display:flex;gap:8px;align-items:flex-start;font:700 13px/18px var(--font-text);padding:5px 0}
.se-prop ul{list-style:none;margin:8px 0 0;padding:0}
.se-vers{padding:10px 16px}
.se-vers .vrow{grid-template-columns:56px 1fr auto;padding:6px 0}
"""
se = f"""{NAV("Skills")}
<main class="ad-main">
 <div class="se-top"><div><h1 class="ad-h1">P6 Maths (PSLE)</h1><p class="ad-sub">Kix Tutor, Ask Kix and the Vibe Zone read the published version. <span class="chip c-pub">Published v1.2</span> <span class="chip c-draft">Draft v1.3</span> <span class="chip c-def">{LOCK}Default v1.0 (built in)</span></p></div>
 <div class="se-tools"><span class="btn b-sec">Import skill (.zip, .skill)</span><span class="btn b-muse">{SPARK}Enhance with Muse</span><span class="btn b-sec">Save draft</span><span class="btn b-pri">Publish v1.3</span></div></div>
 <div class="se-grid">
  <div class="card se-files"><h3>Pack files</h3><a>skill.json <small>manifest</small></a><a class="on">SKILL.md <small>edited</small></a><h3>References</h3><a>heuristics.md <small>+2 sections</small></a><a>tutoring-method.md</a><a>exam-patterns.md <small>from knowledge</small></a><h3>Items</h3><a>original-01.json <small>40</small></a><a>enhance-v1.3.json <small>+6 new</small></a></div>
  <div class="se-ed"><div class="card" style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center"><span class="h2">SKILL.md</span><span class="ad-sub" style="margin:0">Editing the draft. The default stays untouched.</span></div>
   <div class="se-text mono"><span class="h"># P6 Maths (PSLE) tutor</span><br><br><span class="k">## How Kix teaches</span><br>1. Read the question twice; underline what stays the same.<br>2. Pick the heuristic: model drawing, before-and-after, units and parts, guess and check.<br>3. Draw it before you calculate. Ask: what is one unit?<br><span class="diff-add">4. For before-and-after with a total that stays the same, draw both bars to the same length first.</span><br><br><span class="k">## Common traps</span><br>- Mixing up "more than" and "times as many".<br>- Forgetting units in the final answer.<br><span class="diff-add">- Treating a transfer as a change in the total (it isn't).</span></div>
   <div class="card se-vers"><span class="h2">Versions</span>
    <div class="vrow"><b>v1.3</b><span>Draft <small>Enhance with Muse, 29 Oct 10:42, demo@mykx.ai</small></span><span class="acts"><span class="btn b-sec">Diff</span><span class="btn b-del">Delete</span></span></div>
    <div class="vrow"><b>v1.2</b><span><span class="chip c-pub">Published</span> <small>Knowledge: 2025 SA2 papers, 28 Oct</small></span><span class="acts"><span class="btn b-sec">Diff</span></span></div>
    <div class="vrow"><b>v1.1</b><span>Earlier <small>Edited SKILL.md, 27 Oct</small></span><span class="acts"><span class="btn b-sec">Diff</span><span class="btn b-sec">Restore</span><span class="btn b-del">Delete</span></span></div>
    <div class="vrow"><b>v1.0</b><span><span class="chip c-def">{LOCK}Default</span> <small>Built into myKx; can't be deleted</small></span><span class="acts"><span class="btn b-sec">Diff</span><span class="btn b-sec">Restore</span></span></div></div></div>
  <div class="se-side">
   <div class="card"><span class="h2">{SPARK} Enhance with Muse</span><p class="ad-sub">Tell Muse what to improve. It proposes changes as a draft you review; nothing is published by itself.</p><div class="se-ask" style="margin-top:10px">Add practice on before-and-after with the total unchanged, and the trap where children change the total. Six questions, PSLE style, two of them 4 marks.</div><div style="display:flex;justify-content:flex-end;margin-top:8px"><span class="btn b-muse">{SPARK}Ask Muse</span></div>
    <ul class="se-prop"><li><span class="chip c-muse">+1</span>Teaching step in SKILL.md</li><li><span class="chip c-muse">+2</span>Sections in heuristics.md</li><li><span class="chip c-muse">+6</span>New questions with worked answers, checked by Muse</li><li><span class="chip c-warn">1 to check</span>Question 4's answer used a different method: review it</li></ul><div style="display:flex;gap:6px;margin-top:6px"><span class="btn b-sec">Review diff</span><span class="btn b-pri">Accept into draft</span></div></div>

  </div>
 </div>
</main>"""
board("SkillEditor", "Skills: edit, enhance and versions", 1440, 900, "anime-sky", se, se_css)

# 4. Import a skill (1440x900): the admin's Skills page with the import sheet open
im_css = ad_css + """
.im-back{position:absolute;inset:0;background:rgba(15,20,48,.45)}
.im-sheet{position:absolute;left:50%;top:60px;transform:translateX(-50%);width:760px;padding:22px 24px;border-radius:26px;background:var(--surface-raised);box-shadow:0 30px 80px rgba(10,8,40,.45)}
.im-drop{margin-top:14px;padding:18px;border-radius:18px;box-shadow:inset 0 0 0 2px var(--accent);background:var(--surface);display:flex;align-items:center;gap:14px}
.im-drop b{font:800 15px var(--font-text)}
.im-list{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:8px}
.im-list li{display:grid;grid-template-columns:110px 1fr;gap:12px;align-items:center;font:700 13.5px/19px var(--font-text)}
.im-form{margin-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.im-f{border-radius:12px;box-shadow:inset 0 0 0 2px var(--line);padding:8px 10px}
.im-f small{display:block;font:700 11px var(--font-text);color:var(--ink-muted)}
.im-f b{font:800 14px var(--font-text)}
.im-f.over{box-shadow:inset 0 0 0 2px #1F66C1}
"""
im = f"""{NAV("Skills")}
<main class="ad-main"><h1 class="ad-h1">Skills</h1><p class="ad-sub">Seven packs for P3, P6 and Sec 2.</p></main>
<div class="im-back"></div>
<section class="im-sheet"><div style="display:flex;justify-content:space-between;align-items:center"><h2 class="ad-h1" style="font-size:22px">Import a skill</h2><span class="btn b-sec">Close</span></div>
 <p class="ad-sub">A standard agent skill: a folder with SKILL.md and its references, as a .zip or a .skill file. myKx keeps text only and never keeps or runs scripts.</p>
 <div class="im-drop"><span class="chip c-def">.skill</span><span><b>p5-maths-fractions.skill</b><small style="display:block;font:600 12px var(--font-text);color:var(--ink-muted)">184 KB, 9 files</small></span><span class="btn b-sec" style="margin-left:auto">Choose another</span></div>
 <ul class="im-list">
  <li><span class="chip c-ok">Found</span>SKILL.md with a name and description in its front matter</li>
  <li><span class="chip c-ok">Kept</span>4 references (fractions-model.md, traps.md, word-problems.md, exam-format.md) and 1 items file (24 questions)</li>
  <li><span class="chip c-warn">Removed</span>scripts/make_paper.py and scripts/render.js: scripts are never kept or run</li>
  <li><span class="chip c-flag">Check</span>A child's first name ("Kai") appears 3 times in SKILL.md. Packs never name a child. Replace it with a generic name or remove it before importing.</li>
  <li><span class="chip c-muse">{SPARK}Muse</span>Proposed the manifest from SKILL.md: level, subject, topics and which agents may load it. Edit anything below.</li>
 </ul>
 <div class="im-form"><div class="im-f"><small>Pack id</small><b>p5-maths</b></div><div class="im-f over"><small>Level (changed by you)</small><b>P5</b></div><div class="im-f"><small>Subject</small><b>Maths</b></div><div class="im-f"><small>Tier</small><b>Standard</b></div></div>
 <div class="im-form" style="grid-template-columns:1fr 1fr"><div class="im-f"><small>Topics</small><b>Fractions of a set, fraction word problems, remainder concept</b></div><div class="im-f"><small>Agents</small><b>Kix Tutor auto · Ask Kix on demand · Vibe on demand</b></div></div>
 <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><span class="btn b-sec">Cancel</span><span class="btn b-pri">Import as draft v1.0</span></div>
</section>"""
board("SkillImport", "Skills: import a standard agent skill", 1440, 900, "anime-sky", im, im_css)

# 5. Knowledge review session (1440x900)
ks_css = ad_css + """
.ks-grid{position:absolute;left:28px;right:28px;top:112px;bottom:22px;display:grid;grid-template-columns:330px minmax(0,1fr) 300px;gap:16px}
.ks-file{padding:12px;border-radius:16px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);margin-top:10px}
.ks-file.on{box-shadow:inset 0 0 0 2px var(--accent)}
.ks-file b{font:800 13.5px/18px var(--font-text)}
.ks-file small{display:block;font:600 12px/16px var(--font-text);color:var(--ink-muted);margin-top:2px}
.ks-pair{display:flex;align-items:center;gap:6px;margin-top:8px;font:800 12px var(--font-text);color:#1F5E37}
.ks-sel{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}
.ks-sel span{border-radius:10px;box-shadow:inset 0 0 0 1.5px var(--line);padding:5px 8px;font:800 12px var(--font-text)}
.ks-sel span.over{box-shadow:inset 0 0 0 2px #1F66C1;color:#1F66C1}
.ks-rule{padding:10px 12px;border-radius:14px;background:#FFF7E0;color:#6B4A00;font:700 12.5px/18px var(--font-text)}
table.ks{width:100%;border-collapse:collapse;font:600 13px/18px var(--font-text)}
table.ks th{text-align:left;font:800 12px var(--font-text);color:var(--ink-muted);padding:6px 8px;border-bottom:1px solid var(--line)}
table.ks td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top}
table.ks tr.flag td{background:#FFF4F4}
table.ks tr.warn td{background:#FFFBEF}
.ks-sum li{display:flex;gap:8px;align-items:center;font:700 13px/18px var(--font-text);padding:4px 0}
.ks-sum ul{list-style:none;margin:8px 0;padding:0}
"""
rows = [
    ("Q12", "Before-and-after, total unchanged (4 marks)", "Ali 60, Ben 20", '<span class="chip c-ok">Checks out</span>', ""),
    ("Q13", "Speed: two journeys, same distance", "1 h 36 min", '<span class="chip c-flag">Mismatch</span><br><small>Key: 1 h 36 min. Muse works out 1 h 26 min. Check the key.</small>', "flag"),
    ("Q14", "Area of composite figure with quarter circles", "77 cm²", '<span class="chip c-warn">Spelling</span><br><small>"perimter" in the key → "perimeter"</small>', "warn"),
    ("Q15", "Ratio with a fixed part (3 marks)", "no answer yet", '<span class="chip c-warn">Waiting</span><br><small>Not on the answer sheet\'s page 2</small>', "warn"),
    ("Q16", "Percentage discount then GST", "S$ 107.00", '<span class="chip c-warn">Unusual</span><br><small>5 marks for a one-step question</small>', "warn"),
]
trs = "".join(f'<tr class="{c}"><td><b>{q}</b></td><td>{p}</td><td>{a}</td><td>{m}</td><td><span class="btn b-sec" style="height:28px">Edit</span></td></tr>' for q, p, a, m, c in rows)
ks = f"""{NAV("Add knowledge")}
<main class="ad-main">
 <div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h1 class="ad-h1">Review session: 29 Oct papers</h1><p class="ad-sub">Add papers in any order: a question paper now, its answer sheet later. Muse pairs them, sorts them by subject and level, and checks every answer. You can change anything.</p></div><span class="btn b-pri">Add PDFs</span></div>
 <div class="ks-grid">
  <div class="card" style="overflow:hidden"><span class="h2">Papers in this session</span>
   <div class="ks-file on"><b>2025 P6 Maths SA2, Paper 2 (questions)</b><small>School paper, private reference · 18 pages · 17 questions</small><div class="ks-pair">{SPARK}Paired with: answer sheet (added 11:05)</div><div class="ks-sel"><span>P6</span><span>Maths</span><span class="over">Foundation ✎</span></div></div>
   <div class="ks-file"><b>2025 P6 Maths SA2, answer sheet</b><small>Uploaded 11:05 · matched by school, year and paper · 2 pages</small></div>
   <div class="ks-file"><b>Fractions worksheet B (ours)</b><small>Our own material · questions and answers · 12 questions</small><div class="ks-sel"><span class="over">P5 ✎</span><span>Maths</span><span>Standard</span></div></div>
   <div class="ks-file"><b>Science WA1 practice</b><small>Sorted to P3 Science by Muse · no answer sheet yet</small><div class="ks-sel"><span>P3</span><span>Science</span><span>—</span></div></div>
   <p class="ks-rule" style="margin-top:12px">A school paper teaches Kix its patterns, traps and marking. Its questions are never kept or shown to children; Kix writes its own new questions from them.</p>
  </div>
  <div class="card" style="overflow:hidden"><div style="display:flex;justify-content:space-between;align-items:center"><span class="h2">What Muse found: 2025 P6 Maths SA2, Paper 2</span><span class="ad-sub" style="margin:0"><span class="chip c-flag">1 mismatch</span> <span class="chip c-warn">3 to check</span></span></div>
   <table class="ks" style="margin-top:8px"><thead><tr><th>Q</th><th>Pattern</th><th>Answer (from the sheet)</th><th>Muse's check</th><th></th></tr></thead><tbody>{trs}</tbody></table>
   <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center"><span class="h2">{SPARK} Kix's own questions from these patterns (8)</span><span class="btn b-sec">Review all</span></div>
   <table class="ks" style="margin-top:6px"><tbody><tr><td><b>N1</b></td><td>Mei Ling had 4 times as many beads as Sam. After she gave Sam 36 beads, they had the same. How many beads did Mei Ling have at first?</td><td>72</td><td><span class="chip c-ok">Worked twice</span></td><td><span class="btn b-sec" style="height:28px">Edit</span></td></tr></tbody></table>
  </div>
  <div class="card ks-sum"><span class="h2">This refines P6 Maths</span><p class="ad-sub">Publishing makes a new version of the skill; the old one can be restored.</p>
   <ul><li><span class="chip c-muse">+7</span>question patterns, with marks</li><li><span class="chip c-muse">+3</span>traps, from the answer sheet</li><li><span class="chip c-muse">+5</span>marking cues</li><li><span class="chip c-muse">+8</span>new questions by Kix, answers checked</li><li><span class="chip c-muse">+1</span>topic in scope: speed (two journeys)</li></ul>
   <p class="ks-rule">Resolve the mismatch on Q13 before publishing, or mark it "key is right".</p>
   <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px"><span class="btn b-sec" style="justify-content:center">Save as draft v1.3</span><span class="btn b-pri" style="justify-content:center;opacity:.55">Publish to P6 Maths</span></div></div>
 </div>
</main>"""
board("KnowledgeSession", "Add knowledge: a review session that refines a skill", 1440, 900, "anime-sky", ks, ks_css)

# 6. Agent editor (1440x900): Under the hood with Kix Tutor open
ag_css = ad_css + """
.ag-list{position:absolute;left:28px;top:112px;width:300px;bottom:22px}
.ag-list a{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:12px;font:700 14px var(--font-text);color:var(--ink)}
.ag-list a.on{background:var(--surface);box-shadow:inset 0 0 0 2px var(--accent)}
.ag-list small{font:700 11px var(--font-text);color:var(--ink-muted)}
.ag-pane{position:absolute;left:344px;right:28px;top:112px;bottom:22px;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px}
.ag-tabs{display:flex;gap:6px}
.ag-tabs span{padding:7px 14px;border-radius:999px;font:800 13px var(--font-text);box-shadow:inset 0 0 0 2px var(--line)}
.ag-tabs span.on{background:var(--ink);color:var(--surface);box-shadow:none}
.ag-text{margin-top:10px;border-radius:14px;background:#0F1430;color:#DCE3FF;padding:14px 16px;height:330px;overflow:hidden}
.ag-var{background:#2B3A80;color:#FFE38A;border-radius:6px;padding:0 4px}
.ag-guard{margin-top:12px;border-radius:14px;background:var(--surface);box-shadow:inset 0 0 0 2px var(--line);padding:12px 14px}
.ag-guard li{font:700 13px/19px var(--font-text);color:var(--ink-muted)}
"""
ag = f"""{NAV("Under the hood")}
<main class="ad-main">
 <div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h1 class="ad-h1">Under the hood: agents</h1><p class="ad-sub">Click an agent to read and edit its instructions. Every change is a version; the built-in default can't be deleted.</p></div><span class="chip c-muse">13 agents on Meta Muse · 2 rules only</span></div>
 <div class="card ag-list">{''.join(f'<a class="{"on" if n == "Kix Tutor" else ""}">{n}<small>{v}</small></a>' for n, v in [("Kix Tutor", "v3 · edited"), ("Ask Kix", "default"), ("Memory Keeper", "default"), ("Vibe Zone maker", "v2"), ("Content Curator", "default"), ("Home Reader", "default"), ("Guardian Brief", "default"), ("Outing Scout", "default"), ("Outing Planner", "default"), ("Tonight", "v2")])}</div>
 <div class="ag-pane">
  <div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><span class="h2">Kix Tutor</span> <span class="chip c-pub">Published v3</span> <span class="chip c-draft">Editing a draft</span></div><div style="display:flex;gap:6px"><span class="btn b-sec">Try it</span><span class="btn b-sec">Save draft</span><span class="btn b-pri">Publish v4</span></div></div>
   <div class="ag-tabs" style="margin-top:12px"><span class="on">Instructions</span><span>Guardrails {LOCK}</span><span>Tools</span></div>
   <div class="ag-text mono">You are Kix, <span class="ag-var">{{{{nickname}}}}</span>'s friendly study sidekick (Singapore <span class="ag-var">{{{{level}}}}</span>).<br>You are helping with one question during a quest.<br><br>Answer in at most two short sentences a 9-year-old can read aloud.<br>Warm, concrete, no baby talk.<br><span class="diff-add">If the child sounds frustrated, start with one kind line before the hint.</span><br>Point to the thinking: what to notice, what to compare, the next small step.<br>Use the pack's method (claim, evidence, reasoning for science explanations).<br>Read a section before explaining a method you need to get right.</div>
   <div class="ag-guard"><span class="h2">{LOCK} Guardrails (fixed in code, always added)</span><ul style="margin:6px 0 0;padding-left:18px"><li>Never say the answer, which option is right, or the final number.</li><li>Never check the child's current question with a tool.</li><li>Distress words skip the model and bring the caring reply and helplines.</li><li>Every ask counts as a hint; a helped answer never raises mastery.</li></ul></div></div>
  <div class="card"><span class="h2">Versions</span>
   <div class="vrow"><b>v4</b><span>Draft <small>Kind first line, 29 Oct 11:20</small></span><span class="acts"><span class="btn b-sec">Diff</span><span class="btn b-del">Delete</span></span></div>
   <div class="vrow"><b>v3</b><span><span class="chip c-pub">Published</span><small>Shorter hints, 28 Oct</small></span><span class="acts"><span class="btn b-sec">Diff</span></span></div>
   <div class="vrow"><b>v2</b><span>Earlier <small>Junior tone, 27 Oct</small></span><span class="acts"><span class="btn b-sec">Diff</span><span class="btn b-sec">Restore</span><span class="btn b-del">Delete</span></span></div>
   <div class="vrow"><b>v1</b><span><span class="chip c-def">{LOCK}Default</span><small>Built into myKx; can't be deleted</small></span><span class="acts"><span class="btn b-sec">Diff</span><span class="btn b-sec">Restore</span></span></div>
   <div style="margin-top:14px" class="h2">Diff: v3 → draft v4</div>
   <div class="mono" style="margin-top:6px;border-radius:12px;overflow:hidden;box-shadow:inset 0 0 0 1px var(--line)"><span class="diff-ctx">Warm, concrete, no baby talk.</span><span class="diff-add">+ If the child sounds frustrated, start with one kind line before the hint.</span><span class="diff-ctx">Point to the thinking: what to notice…</span></div>
  </div>
 </div>
</main>"""
board("AgentEditor", "Under the hood: edit an agent", 1440, 900, "anime-sky", ag, ag_css)
print("written")
