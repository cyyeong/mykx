#!/usr/bin/env python3
# The grown-ups' Today in two looks (canvas page "Parents, 29 Oct"; founder: designed, not childish; each grown-up picks
# a look). Harbour: navy and slate with brass, structured. Bloom: plum and blush with sage and gold, softer, serif heads.
# Run from a folder that holds canvas-root/project (or set CANVAS_OUT).
import os, html

OUT = os.environ.get("CANVAS_OUT") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "canvas-root", "project")
B = {"harbour": "effea21edd6bddee8bae01fdd8fa26e7", "bloom": "c3a270baeadf99102d2653e044fd3aeb", "wm": "f52e18857979369421011da66fdb9de3"}
img = lambda k: f"/_blob/{B[k]}"

def ico(d, s=18, fill=False):
    p = 'fill="currentColor"' if fill else 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
    return f'<svg viewBox="0 0 24 24" aria-hidden="true" style="width:{s}px;height:{s}px;flex:none"><path {p} d="{d}"/></svg>'

I = {
    "today": "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    "location": "M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    "sentry": "M12 3 4 6v6c0 5 3.4 8.6 8 9.9 4.6-1.3 8-4.9 8-9.9V6zM9 12l2 2 4-4",
    "messages": "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z",
    "notebook": "M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6zM6 3v18M10 8h5M10 12h5",
    "guild": "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2l-.3 2h-4l-.3-2a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.7a7 7 0 0 1 2-1.2l.3-2h4l.3 2a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z",
    "doors": "M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M14 12h.01",
    "sun": "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
    "rain": "M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 9.5 4 4 0 0 1 18 17.4M9 20l-1 2M13 20l-1 2M17 20l-1 2",
    "spark": "M12 2c.6 4.8 4.2 8.4 9 9-4.8.6-8.4 4.2-9 9-.6-4.8-4.2-8.4-9-9 4.8-.6 8.4-4.2 9-9z",
    "eye": "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
}

LOOKS = {
    "harbour": dict(bg="#EDF1F6", surface="#FFFFFF", ink="#0F1B2D", muted="#5B6B80", line="#D8E0EA", accent="#2F5FA8", accent2="#C9A45C", soft="#E3EBF6", rail="#0F1B2D", railInk="#C7D3E3", railOn="#FFFFFF", scrim="rgba(15,27,45,.92)", heroInk="#FFFFFF", heroMuted="#C7D3E3", radius="14px", display="'Outfit',system-ui,sans-serif", dweight="600", art="harbour", name="Harbour", greet="Good evening"),
    "bloom": dict(bg="#F7EFEC", surface="#FFFCFB", ink="#3A2140", muted="#7A6470", line="#EBDDD9", accent="#B4577D", accent2="#7FA08A", soft="#F6E4E9", rail="#FFFCFB", railInk="#7A6470", railOn="#3A2140", scrim="rgba(255,250,247,.94)", heroInk="#3A2140", heroMuted="#7A6470", radius="22px", display="ui-serif,'New York','Iowan Old Style',Georgia,serif", dweight="600", art="bloom", name="Bloom", greet="Good evening"),
}

def board(name, title, w, h, body, css):
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
<style>body{{margin:0}} .bd{{width:{w}px;height:{h}px;position:relative;overflow:hidden;box-sizing:border-box;font-family:'Outfit',system-ui,sans-serif}} .bd *{{box-sizing:border-box}} .bd h1,.bd h2,.bd h3,.bd p{{margin:0}}
{css}</style>
</helmet>
<div class="bd">
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

def css_for(L):
    return f"""
.bd{{background:{L['bg']};color:{L['ink']}}}
.rail{{position:absolute;left:0;top:0;bottom:0;width:236px;background:{L['rail']};color:{L['railInk']};padding:24px 16px;display:flex;flex-direction:column;gap:4px;box-shadow:inset -1px 0 0 {L['line']}}}
.brand{{display:flex;align-items:center;gap:10px;padding:0 10px 22px}}
.brand img{{height:24px;{'filter:brightness(0) invert(1)' if L is LOOKS['harbour'] else ''}}}
.brand span{{font:700 11px/1 'Outfit';letter-spacing:.08em;text-transform:uppercase;color:{L['accent2']}}}
.nv{{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;font:500 15px/20px 'Outfit';color:{L['railInk']}}}
.nv.on{{color:{L['railOn']};background:{'rgba(255,255,255,.08)' if L is LOOKS['harbour'] else L['soft']};box-shadow:inset 3px 0 0 {L['accent2'] if L is LOOKS['harbour'] else L['accent']}}}
.sep{{height:1px;margin:10px 10px;background:{'rgba(255,255,255,.12)' if L is LOOKS['harbour'] else L['line']}}}
.foot{{margin-top:auto;display:flex;flex-direction:column;gap:10px}}
.doors{{display:flex;align-items:center;justify-content:center;gap:8px;height:42px;border-radius:999px;box-shadow:inset 0 0 0 1.5px {'rgba(255,255,255,.3)' if L is LOOKS['harbour'] else L['line']};font:600 14px 'Outfit';color:{L['railOn']}}}
.me{{display:flex;align-items:center;gap:10px;padding:10px;border-radius:14px;background:{'rgba(255,255,255,.06)' if L is LOOKS['harbour'] else L['soft']}}}
.me b{{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:{L['accent']};color:#fff;font:700 14px 'Outfit'}}
.me span{{font:600 13px/17px 'Outfit';color:{L['railOn']}}}
.me small{{display:block;font:500 12px/16px 'Outfit';color:{L['railInk']}}}
.main{{position:absolute;left:236px;right:0;top:0;bottom:0;overflow:hidden}}
.hero{{position:relative;height:300px;overflow:hidden}}
.hero>img{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:{'70% 40%' if L is LOOKS['harbour'] else '80% 30%'}}}
.hero::after{{content:"";position:absolute;inset:0;background:linear-gradient(90deg,{L['scrim']} 0%,{L['scrim']} 34%,rgba(0,0,0,0) 72%)}}
.hin{{position:absolute;z-index:1;left:40px;top:32px;width:640px}}
.eyebrow{{font:600 12px/1 'Outfit';letter-spacing:.12em;text-transform:uppercase;color:{L['accent2']}}}
.hin h1{{margin-top:12px;font:{L['dweight']} 40px/1.05 {L['display']};white-space:nowrap;letter-spacing:-.01em;color:{L['heroInk']}}}
.hin .hh{{margin-top:6px;font:500 16px/22px 'Outfit';color:{L['heroMuted']}}}
.tonight{{margin-top:22px;padding:16px 18px;border-radius:{L['radius']};background:{'rgba(255,255,255,.08)' if L is LOOKS['harbour'] else 'rgba(255,255,255,.7)'};box-shadow:inset 0 0 0 1px {'rgba(255,255,255,.16)' if L is LOOKS['harbour'] else L['line']};-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}}
.tonight h3{{display:flex;align-items:center;gap:8px;font:600 13px/1 'Outfit';letter-spacing:.06em;text-transform:uppercase;color:{L['accent2']}}}
.tonight p{{margin-top:8px;font:500 15px/22px 'Outfit';color:{L['heroInk']}}}
.tonight small{{display:block;margin-top:8px;font:500 12px 'Outfit';color:{L['heroMuted']}}}
.grid{{position:absolute;left:40px;right:40px;top:324px;display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:18px}}
.card{{border-radius:{L['radius']};background:{L['surface']};box-shadow:0 1px 0 {L['line']},0 12px 30px rgba(20,24,40,.06);padding:18px 20px}}
.card h2{{font:{L['dweight']} 20px/1.2 {L['display']};color:{L['ink']}}}
.card .k{{font:600 11px/1 'Outfit';letter-spacing:.1em;text-transform:uppercase;color:{L['accent']}}}
.card p{{margin-top:6px;font:500 14px/20px 'Outfit';color:{L['muted']}}}
.wx{{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}}
.wx div{{border-radius:12px;background:{L['soft']};padding:10px 12px;font:600 13px/18px 'Outfit';color:{L['ink']}}}
.wx div span{{display:flex;align-items:center;gap:6px;color:{L['accent']}}}
.wx small{{display:block;font:500 12px/16px 'Outfit';color:{L['muted']}}}
.btn{{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 18px;border-radius:999px;background:{L['ink']};color:{L['surface']};font:600 14px 'Outfit';margin-top:14px}}
.kid{{display:grid;grid-template-columns:40px 1fr auto;gap:12px;align-items:center;padding:10px 0;border-top:1px solid {L['line']}}}
.kid:first-of-type{{border-top:0}}
.kid b{{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:{L['soft']};color:{L['accent']};font:700 15px 'Outfit'}}
.kid strong{{display:block;font:600 15px/20px 'Outfit'}}
.kid small{{font:500 12.5px/17px 'Outfit';color:{L['muted']}}}
.kid i{{font-style:normal;font:600 12px 'Outfit';padding:4px 10px;border-radius:999px;background:{L['soft']};color:{L['accent']}}}
.note .tag{{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:999px;background:{'#FBF3E2' if L is LOOKS['harbour'] else '#FBEFF3'};color:{'#8A6416' if L is LOOKS['harbour'] else '#9A3E63'};font:600 12px 'Outfit'}}
.note h2{{margin-top:10px}}
.note ul{{margin:10px 0 0;padding-left:18px;font:500 13.5px/20px 'Outfit';color:{L['muted']}}}
.lower{{position:absolute;left:40px;right:40px;top:640px;display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:18px}}
.bars{{display:flex;align-items:flex-end;gap:12px;height:110px;margin-top:14px;padding-bottom:4px;border-bottom:1px dashed {L['line']};position:relative}}
.bars div{{flex:1;border-radius:6px 6px 2px 2px;background:{L['accent']};opacity:.85}}
.bars div.hi{{background:{L['accent2']};opacity:1}}
.lim{{position:absolute;left:0;right:0;top:34px;border-top:1.5px dashed {L['muted']};opacity:.5}}
.days{{display:flex;gap:12px;margin-top:6px;font:600 11px 'Outfit';color:{L['muted']}}}
.days span{{flex:1;text-align:center}}
.well div{{display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid {L['line']};font:500 13.5px/18px 'Outfit'}}
.well div:first-of-type{{border-top:0}}
.well em{{font-style:normal;font-weight:600;color:{L['accent']}}}
.chip{{position:absolute;right:40px;top:24px;z-index:2;display:flex;gap:8px}}
.chip span{{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;background:{'rgba(255,255,255,.12)' if L is LOOKS['harbour'] else 'rgba(255,255,255,.8)'};color:{L['heroInk'] if L is LOOKS['harbour'] else L['ink']};font:600 12px 'Outfit';box-shadow:inset 0 0 0 1px {'rgba(255,255,255,.2)' if L is LOOKS['harbour'] else L['line']}}}
.chip span.on{{background:{L['accent2'] if L is LOOKS['harbour'] else L['accent']};color:{'#0F1B2D' if L is LOOKS['harbour'] else '#fff'};box-shadow:none}}
"""

def body_for(key, L):
    nav = [("today", "Today", True), ("location", "Location", False), ("sentry", "Sentry", False), ("messages", "Messages", False), ("notebook", "Notebook", False)]
    rail = f'''<nav class="rail"><div class="brand"><img src="{img('wm')}" alt="myKx"><span>Parents</span></div>
{"".join(f'<span class="nv{" on" if on else ""}">{ico(I[k])}{label}</span>' for k, label, on in nav)}
<div class="sep"></div><span class="nv">{ico(I['guild'])}Guild Options</span>
<div class="foot"><span class="doors">{ico(I['doors'], 16)}Kids' doors</span><div class="me"><b>D</b><span>Demo Parent<small>Look: {L['name']}</small></span></div></div></nav>'''
    kids = [("J", "Jordan", "P3 · 0 of 30 min today", "Worth a look"), ("A", "Abby", "P6 · 18 min · Maths", "Calm"), ("L", "Leonard", "Sec 2 · 12 min · Science", "Focused")]
    days = [44, 30, 42, 58, 30, 44, 0]
    return f'''{rail}
<div class="main">
 <section class="hero"><img src="{img(L['art'])}" alt="">
  <div class="chip"><span class="{'on' if key == 'harbour' else ''}">Harbour</span><span class="{'on' if key == 'bloom' else ''}">Bloom</span></div>
  <div class="hin"><p class="eyebrow">Thursday 29 October · evening</p><h1>{L['greet']}, Demo&nbsp;Parent</h1><p class="hh">Demo family · three kids · everything quiet at home</p>
   <div class="tonight"><h3>{ico(I['spark'], 14, True)}Tonight</h3><p>Jordan has an unseen note: possibly tired in three evening sessions, worth a check. The day looked calm otherwise. Jordan had no time on myKx today against a 30-minute limit.</p><small>Muse Spark · from today's screen time, learning, the map and the cameras · 23:44</small></div></div>
 </section>
 <div class="grid">
  <article class="card"><span class="k">This weekend</span><h2>Do something together</h2><p>Cycling by the river on Saturday, a swim and badminton indoors for Sunday's showers. Sourced from the web, planned around the weather.</p>
   <div class="wx"><div><span>{ico(I['sun'], 16)}Saturday</span><small>Partly cloudy · 26–35°C · 2 ideas</small></div><div><span>{ico(I['rain'], 16)}Sunday</span><small>Thundery showers · 25–33°C · 2 ideas</small></div></div>
   <span class="btn">See the weekend plan</span></article>
  <article class="card"><span class="k">Today</span><h2>The kids</h2>{"".join(f'<div class="kid"><b>{a}</b><span><strong>{n}</strong><small>{d}</small></span><i>{t}</i></div>' for a, n, d, t in kids)}</article>
  <article class="card note"><span class="tag">{ico(I['eye'], 13)}Worth a look · since Friday</span><h2>Jordan seemed tired in three evening sessions</h2><ul><li>Wed after 8 pm: told Kix “so tired, can we stop soon”</li><li>Sun after 8 pm: three pauses of a minute or more</li></ul><span class="btn">Mark as seen</span></article>
 </div>
 <div class="lower">
  <article class="card"><span class="k">Screen time · Jordan</span><h2>0 min today <span style="font:500 13px 'Outfit';color:{L['muted']}">· limit 30 a day</span></h2>
   <div class="bars"><i class="lim"></i>{"".join(f'<div class="{"hi" if v > 50 else ""}" style="height:{max(4, v * 1.7)}px"></div>' for v in days)}</div>
   <div class="days">{"".join(f"<span>{d}</span>" for d in ["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"])}</div></article>
  <article class="card well"><span class="k">Wellbeing this week</span><div><span>Wed 8:40 pm · possibly tired</span><em>Focus 66</em></div><div><span>Wed 4:30 pm · seemed settled</span><em>Focus 100</em></div><div><span>Tue 4:30 pm · possibly curious</span><em>Focus 100</em></div></article>
  <article class="card"><span class="k">Kix suggests</span><h2>An earlier slot this week</h2><p>Sleep helps today's learning stick. Kix will start Jordan gently tomorrow.</p></article>
 </div>
</div>'''

for key, L in LOOKS.items():
    board(f"Parent{L['name']}", f"Parents' Today: {L['name']}", 1440, 900, body_for(key, L), css_for(L))
print("written")
