#!/usr/bin/env python3
# Builds the README / video boards (1600x900) as canvas .dc.html files (copies in docs/design/boards/Readme*.dc.html).
# Builds the README / video boards (1600x900) as canvas .dc.html files.
import json, os, html

S = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(S, "canvas-root", "project")
B = json.load(open(os.path.join(S, "rd-blobs.json")))
img = lambda k: f"/_blob/{B[k]}"

SPARK = '<svg class="rd-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z"/></svg>'

DOT = SPARK.replace('class="rd-spark" ', '')

def muse(label):
    return f'<span class="rd-m">{SPARK}{label}</span>'

def rules(label="Rules"):
    return f'<span class="rd-r">{label}</span>'

CSS = """
body{margin:0;background:#1C1B4A}
.rd{width:1600px;height:900px;position:relative;overflow:hidden;font-family:"Nunito",system-ui,sans-serif;color:#2B2A5C;background:#F4F1FF;box-sizing:border-box}
.rd *{box-sizing:border-box}
.rd.dark{background:#1C1B4A;color:#F4F1FF}
.rd h1,.rd h2,.rd h3,.rd p{margin:0}
.rd-h1{font-family:"Fredoka",system-ui,sans-serif;font-weight:600;font-size:80px;line-height:86px;letter-spacing:-0.5px}
.rd-h2{font-family:"Fredoka",system-ui,sans-serif;font-weight:600;font-size:62px;line-height:68px;letter-spacing:-0.3px}
.rd-lede{font-size:26px;line-height:37px;font-weight:600;color:#4B4880}
.dark .rd-lede{color:#D9D3FF}
.rd-spark{width:16px;height:16px;fill:currentColor;flex:none}
.rd-m{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border-radius:999px;background:#B9A7F5;color:#1C1B4A;font:800 17px/1 "Nunito",sans-serif;white-space:nowrap}
.rd-r{display:inline-flex;align-items:center;height:34px;padding:0 14px;border-radius:999px;box-shadow:inset 0 0 0 2px #2C7A47;color:#1F5E37;font:800 17px/1 "Nunito",sans-serif;white-space:nowrap}
.dark .rd-r{box-shadow:inset 0 0 0 2px #A8F0D4;color:#A8F0D4}
.rd-chips{display:flex;flex-wrap:wrap;gap:8px}
.rd-phone{background:#0F0E2A;border-radius:46px;padding:9px;box-shadow:0 28px 60px rgba(28,27,74,.35)}
.rd-phone img{display:block;width:100%;border-radius:38px}
.rd-shot{border-radius:16px;overflow:hidden;box-shadow:0 0 0 1px rgba(185,167,245,.35),0 24px 50px rgba(10,8,40,.35);background:#0F0E2A}
.rd-shot img{display:block;width:100%}
.rd-thread{position:absolute;inset:0;pointer-events:none}
.rd-thread path{fill:none;stroke:#FFE38A;stroke-width:3;stroke-linecap:round;filter:drop-shadow(0 0 6px rgba(255,227,138,.9))}
.rd-foot{position:absolute;left:88px;bottom:40px;font:700 18px/26px "Nunito",sans-serif;color:#8C87C4}
.dark .rd-foot{color:#9D97D6}
"""

def board(name, title, body, dark=True, extra_css=""):
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
<style>{CSS}{extra_css}</style>
</helmet>
<div class="rd{' dark' if dark else ''}">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1600,"height":900}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""
    open(os.path.join(OUT, f"{name}.dc.html"), "w").write(doc)

# 1. Hero ----------------------------------------------------------------------------------------------------
hero_css = """
.h-bg{position:absolute;inset:0;background:radial-gradient(120% 90% at 70% 10%,#3A3478 0%,#24215A 45%,#1A1846 100%)}
.h-art{position:absolute;left:298px;top:90px;width:1418px;height:810px;object-fit:cover;-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 30%),linear-gradient(180deg,transparent 0%,#000 16%);-webkit-mask-composite:source-in;mask-image:linear-gradient(90deg,transparent 0%,#000 30%),linear-gradient(180deg,transparent 0%,#000 16%);mask-composite:intersect}
.h-scrim{position:absolute;inset:0;background:linear-gradient(0deg,rgba(26,24,70,.75) 0%,rgba(26,24,70,0) 22%)}
.h-copy{position:absolute;left:88px;top:72px;width:760px}
.h-mark{height:54px;display:block;margin-bottom:34px}
.h-copy .rd-h1{font-size:68px;line-height:74px}
.h-copy .rd-h1 span{display:block}
.h-copy .rd-lede{margin-top:24px;width:600px;font-size:23px;line-height:34px;color:#E4DFFF}
.h-close{margin-top:28px;font:600 28px/34px "Fredoka",sans-serif;color:#FFE38A}
.h-badges{position:absolute;left:88px;bottom:56px;display:flex;flex-direction:column;gap:14px;width:720px}
.h-hack{display:inline-flex;align-items:center;gap:10px;align-self:flex-start;height:44px;padding:0 18px;border-radius:999px;box-shadow:inset 0 0 0 2px #FFE38A;color:#FFE38A;font:800 19px/1 "Nunito",sans-serif}
.h-muse{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.h-muse .rd-m{height:44px;font-size:19px;padding:0 18px;background:#FFE38A}
.h-muse span.h-models{font:700 18px/26px "Nunito",sans-serif;color:#D9D3FF}
.h-tag{position:absolute;display:flex;flex-direction:column;align-items:center;gap:2px;transform:translateX(-50%);padding:8px 16px 9px;border-radius:18px;background:rgba(22,20,62,.72);backdrop-filter:blur(6px);box-shadow:inset 0 0 0 1.5px var(--c)}
.h-tag b{font-size:26px;line-height:30px;color:#fff}
.h-tag small{font:700 15px/18px "Nunito",sans-serif;color:var(--c)}
"""
build_hero = f"""
<div class="h-bg"></div>
<img class="h-art" src="{img('hero')}" alt="Three Kix sidekicks, the explorer, the performer and the pilot, on a path of starlight in front of a twilight city">
<div class="h-scrim"></div>
<div class="h-copy">
  <img class="h-mark" src="{img('wordmark-dark')}" alt="myKx">
  <h1 class="rd-h1"><span>My kids. My world.</span><span style="margin-top:6px">Their tutor.</span><span>My sidekick.</span></h1>
  <p class="rd-lede">Meet Kix: a specialist AI tutor, a creative companion and your helping hand. Built to understand how each child learns, guide their next discovery, and keep you connected to their progress.</p>
  <p class="h-close">Built for my kids. Made for yours.</p>
</div>
<div class="h-tag" style="--c:#9BE3B0;left:909px;top:772px"><b style="font-family:'Grandstander',sans-serif">Jordan</b><small>P3, critters and jets</small></div>
<div class="h-tag" style="--c:#FF8FE0;left:1171px;top:772px"><b style="font-family:'Unbounded',sans-serif;font-size:22px">Leonard</b><small>Sec 2, K-pop and dance</small></div>
<div class="h-tag" style="--c:#F7B6CF;left:1418px;top:772px"><b style="font-family:'M PLUS Rounded 1c',sans-serif;font-weight:800">Abby</b><small>P6, into anime</small></div>
<div class="h-badges">
  <span class="h-hack">{SPARK}Built for the Meta Global AI Developer Hackathon</span>
  <div class="h-muse">{muse('Powered by Meta Muse')}<span class="h-models">Muse Spark, Muse Image, SAM 3.1 and Muse Voice Transcribe</span></div>
</div>
"""
board("ReadmeHero", "myKx README: hero", build_hero, True, hero_css)

# 2. Why --------------------------------------------------------------------------------------------------------
why_css = """
.w-left{position:absolute;left:88px;top:76px;width:680px}
.w-left .rd-h1{font-size:66px;line-height:72px}
.w-left .rd-lede{margin-top:26px}
.w-left .w-turn{margin-top:22px;font:800 28px/38px "Nunito",sans-serif;color:#2B2A5C}
.w-quote{position:absolute;left:88px;bottom:64px;width:660px;margin:0;padding:26px 32px 24px;border-radius:28px;background:#2B2A5C;color:#F4F1FF}
.w-quote p{font:600 21px/31px "Nunito",sans-serif}
.w-quote cite{display:block;margin-top:14px;font:800 18px/24px "Nunito",sans-serif;font-style:normal;color:#FFE38A}
.w-day{position:absolute;left:820px;top:72px;width:700px}
.w-day h3{font:600 30px/36px "Fredoka",sans-serif;color:#2B2A5C;margin-bottom:22px}
.w-row{position:relative;display:grid;grid-template-columns:92px 1fr;gap:0 22px;padding:0 0 22px 0}
.w-row time{font:600 26px/34px "Fredoka",sans-serif;color:#6C66B0;text-align:right}
.w-row .w-body{position:relative;padding-left:34px}
.w-row .w-body::before{content:"";position:absolute;left:0;top:9px;width:16px;height:16px;border-radius:50%;background:var(--c);box-shadow:0 0 0 4px #F4F1FF,0 0 0 6px var(--c)}
.w-row:not(:last-child) .w-body::after{content:"";position:absolute;left:7px;top:30px;bottom:-14px;width:2px;background:#E5C55A}
.w-row p{font:700 22px/31px "Nunito",sans-serif;color:#2B2A5C}
.w-row p b{color:var(--k)}
.w-row .rd-chips{margin-top:8px}
"""
rows = [
    ("13:40", "#1F66C1", "#1F66C1", "Leonard", "left school and took the bus home.", rules("Location rules")),
    ("15:10", "#2C7A47", "#2C7A47", "Jordan", "finished the frog life-cycle quest: 3 of 3, and a new Treasure card.", muse("Kix Tutor") + rules("Mastery rules")),
    ("16:20", "#C2338F", "#C2338F", "Abby", "photographed a fractions question. Kix guided each step and never gave the answer away.", muse("Ask Kix")),
    ("17:08", "#D9822B", "#B5651D", "At home,", "possibly a tug-of-war in the living room. The parent looks at the pictures and taps Not right.", muse("Home Reader") + muse("SAM 3.1")),
    ("18:30", "#1C8EA8", "#1C6C84", "Saturday", "looks drier: cycle the riverside, then hawker supper.", muse("Outing Scout, web search")),
    ("21:30", "#6A47F0", "#6A47F0", "Tonight,", "one calm paragraph about all three, ready when the parent is.", muse("Tonight")),
]
rows_html = "".join(f'<div class="w-row" style="--c:{c};--k:{k}"><time>{t}</time><div class="w-body"><p><b>{who}</b> {txt}</p><div class="rd-chips">{chips}</div></div></div>' for t, c, k, who, txt, chips in rows)
build_why = f"""
<div class="w-left">
  <h1 class="rd-h1">Working parents miss the afternoon.</h1>
  <p class="rd-lede">In Singapore, school ends around 1:30 and work ends after 6. In between, three children learn, play, squabble and wander home, while a parent at work sees none of it.</p>
  <p class="w-turn">myKx keeps the afternoon for them.</p>
</div>
<blockquote class="w-quote"><p>“I’m a parent of three hyperactive kids, each with a different nature and different interests. Getting them to talk about schoolwork at all is a challenge. So I built a place where what they love becomes how they learn.”</p><cite>The founder of myKx</cite></blockquote>
<div class="w-day"><h3>One Tuesday, as the parent sees it</h3>{rows_html}</div>
"""
board("ReadmeWhy", "myKx README: why", build_why, False, why_css)

# 3. Three kids ---------------------------------------------------------------------------------------------------
kids_css = """
.k-head{position:absolute;left:88px;top:68px;width:1420px;display:flex;align-items:flex-end;justify-content:space-between;gap:40px}
.k-head .rd-lede{width:560px;font-size:23px;line-height:33px}
.k-cols{position:absolute;left:88px;right:88px;top:250px;bottom:58px;display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.k-col{position:relative;border-radius:30px;overflow:hidden;background:var(--bg);display:flex;flex-direction:column}
.k-art{height:200px;position:relative;overflow:hidden}
.k-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 32%}
.k-text{padding:20px 26px 0;flex:1}
.k-name{display:flex;align-items:baseline;gap:12px}
.k-name b{font-size:44px;line-height:48px;color:var(--ink)}
.k-name span{font:800 18px/22px "Nunito",sans-serif;color:var(--soft)}
.k-into{margin-top:6px;font:700 20px/28px "Nunito",sans-serif;color:var(--soft)}
.k-list{margin:14px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
.k-list li{position:relative;padding-left:26px;font:700 19px/26px "Nunito",sans-serif;color:var(--ink)}
.k-list li svg{position:absolute;left:0;top:5px;width:16px;height:16px;fill:var(--acc)}
.k-shot{margin:16px 26px 24px;border-radius:14px;overflow:hidden;height:150px;box-shadow:0 0 0 1px rgba(255,255,255,.25)}
.k-shot img{width:100%;height:100%;object-fit:cover;object-position:50% 0;display:block}
"""
def kid(name, font, size, level, world, into, items, art, shot, bg, ink, soft, acc, weight=700):
    lis = "".join(f"<li>{DOT}{i}</li>" for i in items)
    return f"""<section class="k-col" style="--bg:{bg};--ink:{ink};--soft:{soft};--acc:{acc}">
  <div class="k-art"><img src="{img(art)}" alt="{name}'s Kix"></div>
  <div class="k-text">
    <div class="k-name"><b style="font-family:{font};font-weight:{weight};font-size:{size}px">{name}</b><span>{level}, {world}</span></div>
    <p class="k-into">Into {into}</p>
    <ul class="k-list">{lis}</ul>
  </div>
  <div class="k-shot"><img src="{img(shot)}" alt="{name}'s screen in myKx"></div>
</section>"""
build_kids = f"""
<div class="k-head">
  <h1 class="rd-h2" style="width:820px">Three kids. Three worlds.<br>One sidekick each.</h1>
  <p class="rd-lede">Each child picks a world and the things they love in Sidekick Studio, and Kix becomes part of it. Underneath, every world runs the same honest learning engine.</p>
</div>
<div class="k-cols">
{kid("Jordan", "'Grandstander',sans-serif", 44, "Primary 3", "Terrarium", "critters and jets", ["The frog life-cycle quest", "Critter Lab: a tadpole that grows with mastery", "Sky Squadron: a display jet for every four fresh questions"], "kix-terrarium", "jordan-home", "#E7F2DD", "#1D3324", "#3F6B4C", "#2C7A47")}
{kid("Abby", "'M PLUS Rounded 1c',sans-serif", 44, "Primary 6", "Anime Sky", "anime", ["Kix sparks her focus with how animators draw", "Vibe Zone flashcards from Abby's own brief", "PSLE Maths and Science packs"], "kix-anime", "abby-home", "#1B2350", "#FFFFFF", "#F7B6CF", "#5AA9F0", 800)}
{kid("Leonard", "'Unbounded',sans-serif", 30, "Secondary 2", "Idol Stage", "K-pop, dance and anime", ["Neon Strike: science words at typing speed", "A dance break when his focus dips", "A study deck with mastery rings"], "kix-idol", "leonard-neon", "#241640", "#FFFFFF", "#FF9BE6", "#FF3DCB")}
</div>
"""
board("ReadmeKids", "myKx README: three kids", build_kids, True, kids_css)

# 4. Learning loop ------------------------------------------------------------------------------------------------
loop_css = """
.l-head{position:absolute;left:88px;top:68px;width:1420px;display:flex;justify-content:space-between;align-items:flex-end;gap:40px}
.l-head .rd-lede{width:520px;font-size:23px;line-height:33px}
.l-grid{position:absolute;left:88px;right:88px;top:250px;display:grid;grid-template-columns:repeat(3,1fr);gap:50px 40px}
.l-step{position:relative;padding:26px 28px 24px;border-radius:26px;background:#FFFFFF;box-shadow:inset 0 0 0 2px #E2DCFF;min-height:240px;display:flex;flex-direction:column}
.l-step.muse{background:#2B2A5C;color:#F4F1FF;box-shadow:none}
.l-num{position:absolute;top:-22px;left:24px;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:#FFE38A;color:#2B2A5C;font:600 24px/1 "Fredoka",sans-serif;box-shadow:0 0 0 5px #F4F1FF}
.l-step h3{font:600 30px/36px "Fredoka",sans-serif;margin-top:6px}
.l-step p{margin-top:10px;font:700 19px/28px "Nunito",sans-serif;color:#4B4880;flex:1}
.l-step.muse p{color:#D9D3FF}
.l-step .rd-chips{margin-top:14px}
.l-step.muse .rd-r{box-shadow:inset 0 0 0 2px #A8F0D4;color:#A8F0D4}
.l-back{position:absolute;right:88px;bottom:34px;font:800 18px/24px "Nunito",sans-serif;color:#6C66B0}
"""
steps = [
    ("Past-paper scout", "Every Monday it checks approved Singapore paper sites, within each site's robots rules, for new papers.", rules("Rules"), False),
    ("Content Curator", "Reads new papers for patterns, traps and how often a topic comes up. It never keeps a school's questions, and an admin approves every change.", muse("Muse Spark"), True),
    ("Seven skill packs", "P3 English, Maths, Science and Chinese; P6 Maths and Science; Sec 2 Science. Original questions in each exam's format.", rules("Reviewed by the founder"), False),
    ("Kix Tutor", "Picks the next question on the child's weakest sub-skill and gives hints that never hand over the answer.", muse("Muse Spark") + rules("Selection rules"), True),
    ("Mastery and Treasure", "Scores and rewards are plain code: a holographic card, a critter that grows, a jet that unlocks. No loot boxes, no rankings, no money.", rules("Rules"), False),
    ("Memory Keeper", "Writes Kix's Notebook: how this child asks, slips and wins, so tomorrow starts where today ended. The parent can edit or wipe it.", muse("Muse Spark"), True),
]
steps_html = "".join(f'<div class="l-step{" muse" if m else ""}"><span class="l-num">{i+1}</span><h3>{t}</h3><p>{d}</p><div class="rd-chips">{c}</div></div>' for i, (t, d, c, m) in enumerate(steps))
build_loop = f"""
<div class="l-head">
  <h1 class="rd-h2" style="width:860px">From past papers to the next right question.</h1>
  <p class="rd-lede">Specialist agents keep learning what Singapore exams ask, and what each child still finds hard.</p>
</div>
<div class="l-grid">{steps_html}</div>
<p class="l-back">Steps 4 to 6 repeat every session, so the questions follow the child.</p>
"""
board("ReadmeLoop", "myKx README: the learning loop", build_loop, False, loop_css)

# 5. Agents -------------------------------------------------------------------------------------------------------
ag_css = """
.a-head{position:absolute;left:88px;top:56px;width:1420px}
.a-head .rd-lede{margin-top:14px;font-size:23px;line-height:33px}
.a-grid{position:absolute;left:88px;top:222px;width:1070px;display:grid;grid-template-columns:repeat(3,1fr);gap:0 30px;align-content:start}
.a-grid > div{display:flex;flex-direction:column;gap:18px}
.a-group h3{font:600 22px/28px "Fredoka",sans-serif;color:#FFE38A;margin-bottom:10px}
.a-agent{padding:10px 0 10px;border-top:1px solid rgba(185,167,245,.25)}
.a-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 10px}
.a-agent b{display:block;font:800 20px/26px "Nunito",sans-serif;color:#FFFFFF}
.a-agent span.d{display:block;font:600 16px/21px "Nunito",sans-serif;color:#B8B2E8;margin:5px 0 0}
.a-agent .rd-m,.a-agent .rd-r{height:26px;font-size:14px;padding:0 10px;gap:5px}
.a-agent .rd-spark{width:12px;height:12px}
.a-side{position:absolute;right:88px;top:222px;width:330px;padding:26px 26px 22px;border-radius:26px;background:#2B2A5C}
.a-side h3{font:600 24px/30px "Fredoka",sans-serif;margin-bottom:12px}
.a-count{display:grid;grid-template-columns:56px 1fr;align-items:center;gap:6px 12px;padding:9px 0;border-top:1px solid rgba(185,167,245,.2)}
.a-count b{font:600 40px/44px "Fredoka",sans-serif;color:#FFE38A;text-align:right}
.a-count span{font:700 18px/24px "Nunito",sans-serif;color:#F4F1FF}
.a-count span small{display:block;font:600 14px/18px "Nunito",sans-serif;color:#B8B2E8}
.a-note{margin-top:14px;font:600 16px/23px "Nunito",sans-serif;color:#D9D3FF}
"""
groups = [
    ("Learning", [("Kix Tutor", "Hints and explanations for each question", muse("Muse Spark")), ("Ask Kix", "Homework help from a typed question or a photo", muse("Muse Spark")), ("Content Curator", "Reads past papers for patterns and traps", muse("Muse Spark")), ("Past-paper scout", "Finds new papers every week", rules()), ("Skill Editor", "Improves a skill pack when an admin asks", muse("Muse Spark"))]),
    ("Imagination", [("Sidekick Studio", "Turns Kix into the child's own world", muse("Muse Image") + " " + muse("SAM 3.1")), ("Vibe Zone maker", "Flashcards from the child's own brief", muse("Muse Spark")), ("Talk to Kix", "Push to talk; the audio is never kept", muse("Muse Voice Transcribe"))]),
    ("Home and outdoors", [("Home Reader", "Reads the family's own camera frames, with vision", muse("Muse Spark")), ("Who's who", "Outlines the children on a flagged frame", muse("SAM 3.1")), ("Guardian Brief", "The “Right now” line for the parent", muse("Muse Spark"))]),
    ("Memory and care", [("Memory Keeper", "Keeps Kix's Notebook about each child", muse("Muse Spark")), ("Screen-time guardian", "Breaks, quiet hours, the day's balance", rules())]),
    ("Family time", [("Outing Scout", "Searches the web for things to do near home", muse("Muse Spark")), ("Outing Planner", "Plans the weekend around the weather", muse("Muse Spark")), ("Tonight", "The evening summary for the parent", muse("Muse Spark"))]),
]
def grp(name, agents):
    return f'<div class="a-group"><h3>{name}</h3>' + "".join(f'<div class="a-agent"><div class="a-top"><b>{a}</b><div class="rd-chips">{c}</div></div><span class="d">{d}</span></div>' for a, d, c in agents) + "</div>"
cols = [grp(*groups[0]), grp(*groups[1]) + grp(*groups[4]), grp(*groups[2]) + grp(*groups[3])]
build_agents = f"""
<div class="a-head">
  <h1 class="rd-h2">16 specialists. 14 of them run on Meta Muse.</h1>
  <p class="rd-lede">Muse reads, explains and imagines. Plain rules decide every score, reward and alert.</p>
</div>
<div class="a-grid">{''.join(f'<div>{c}</div>' for c in cols)}</div>
<aside class="a-side">
  <h3>Meta models in myKx</h3>
  <div class="a-count"><b>11</b><span>Muse Spark 1.3<small>Standard mode: chat, vision, structured output, web search</small></span></div>
  <div class="a-count"><b>2</b><span>SAM 3.1<small>Kix cut-outs and outlines on flagged frames</small></span></div>
  <div class="a-count"><b>1</b><span>Muse Image 1.0<small>Kix in every world, cards, critters and jets</small></span></div>
  <div class="a-count"><b>1</b><span>Muse Voice Transcribe 1.0<small>Talk to Kix</small></span></div>
  <div class="a-count"><b>2</b><span>Rules only<small>No model at all</small></span></div>
  <p class="a-note">Children's data only ever goes to Standard models, never contributor mode. Every call is logged in Under the hood with its model, time, tokens and cost.</p>
</aside>
"""
board("ReadmeAgents", "myKx README: 16 agents", build_agents, True, ag_css)

# 6. Beyond the screen --------------------------------------------------------------------------------------------
out_css = """
.o-left{position:absolute;left:88px;top:76px;width:560px}
.o-left .rd-lede{margin-top:24px;font-size:24px;line-height:35px}
.o-care{position:absolute;left:88px;bottom:64px;width:560px;padding:26px 30px;border-radius:26px;background:#2B2A5C;color:#F4F1FF}
.o-care h3{font:600 26px/32px "Fredoka",sans-serif;color:#FFE38A;margin-bottom:12px}
.o-care ul{margin:0;padding:0;list-style:none;display:grid;gap:9px}
.o-care li{position:relative;padding-left:28px;font:700 19px/26px "Nunito",sans-serif}
.o-care li svg{position:absolute;left:0;top:5px;width:16px;height:16px;fill:#A8F0D4}
.o-phones{position:absolute;left:700px;right:64px;top:56px;display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.o-phone .rd-phone{width:100%}
.o-phone .rd-phone img{height:560px;object-fit:cover;object-position:50% 0}
.o-cap{margin-top:18px}
.o-cap h3{font:600 24px/30px "Fredoka",sans-serif;color:#2B2A5C}
.o-cap p{margin-top:4px;font:700 16px/23px "Nunito",sans-serif;color:#4B4880}
.o-cap .rd-chips{margin-top:8px}
.o-cap .rd-m,.o-cap .rd-r{height:28px;font-size:14px;padding:0 10px}
"""
li = lambda t: f"<li>{DOT}{t}</li>"
phones = [
    ("phone-where", "Where they are", "Places from the phone; motion worked out by rules. Muse writes the “Right now” line from place names, never coordinates.", rules("Motion rules") + muse("Guardian Brief")),
    ("phone-home", "Home now", "The family's own cameras, read by Muse Spark. SAM 3.1 outlines the children on a flagged frame, and the parent decides.", muse("Home Reader") + muse("SAM 3.1")),
    ("phone-together", "Do something together", "Muse searches the web near home, checks NEA's weather and plans the weekend around the kids' interests.", muse("Outing Scout") + muse("Planner")),
]
phones_html = "".join(f'<figure class="o-phone" style="margin:0"><div class="rd-phone"><img src="{img(k)}" alt="{t} on the parent\'s phone"></div><figcaption class="o-cap"><h3>{t}</h3><p>{d}</p><div class="rd-chips">{c}</div></figcaption></figure>' for k, t, d, c in phones)
build_out = f"""
<div class="o-left">
  <h1 class="rd-h1" style="font-size:70px;line-height:78px">Learning doesn't stop at the screen.</h1>
  <p class="rd-lede">Where the kids are, how home feels and what the weather allows become care for the parent, and plans to do together outdoors.</p>
</div>
<div class="o-care"><h3>Care, not surveillance</h3><ul>{li("Opt-in, and the child always sees when it's on")}{li("No cameras in bedrooms or bathrooms")}{li("Flagged pictures are deleted after 24 hours")}{li("Kix and the tutor never see any of it")}</ul></div>
<div class="o-phones">{phones_html}</div>
"""
board("ReadmeOutdoors", "myKx README: beyond the screen", build_out, False, out_css)

# 7. Simulator and Home Link --------------------------------------------------------------------------------------
sim_css = """
.s-head{position:absolute;left:88px;top:66px;width:1420px;display:flex;justify-content:space-between;align-items:flex-end;gap:40px}
.s-head .rd-lede{width:640px;font-size:21px;line-height:30px}
.s-badge{display:inline-flex;align-items:center;height:34px;padding:0 14px;border-radius:999px;background:#FF3DCB;color:#fff;font:800 16px/1 "Nunito",sans-serif;margin-bottom:14px}
.s-sim{position:absolute;left:88px;top:300px;width:760px}
.s-label{margin-top:14px;font:700 18px/25px "Nunito",sans-serif;color:#D9D3FF}
.s-label b{color:#fff}
.s-phone{position:absolute;left:944px;top:262px;width:250px}
.s-phone .rd-phone img{height:500px;object-fit:cover;object-position:50% 0}
.s-api{position:absolute;left:820px;top:520px;transform:translateX(-50%);padding:6px 12px;border-radius:999px;background:#1C1B4A;box-shadow:inset 0 0 0 2px #FFE38A;color:#FFE38A;font:800 15px/1 "Nunito",sans-serif;white-space:nowrap}
.s-link{position:absolute;right:88px;top:262px;width:300px;padding:22px 22px 20px;border-radius:24px;background:#2B2A5C}
.s-link h3{font:600 24px/30px "Fredoka",sans-serif;color:#FFE38A}
.s-link p{margin-top:8px;font:700 16px/23px "Nunito",sans-serif;color:#D9D3FF}
.s-link .rd-shot{margin-top:14px}
"""
build_sim = f"""
<div class="s-head">
  <div style="width:720px"><span class="s-badge">Built for this hackathon, synthetic data</span><h1 class="rd-h2">Tomorrow's devices, simulated today.</h1></div>
  <p class="rd-lede"><b style="color:#fff">mykx-sim</b> stands in for everything that will feed myKx: the myKx mobile app, home cameras, and peripherals for location, motion and health. It pairs and sends like a real device, through the same API, to prove the protocol end to end and give myKx exactly what a real device would. No real child, home or camera is involved.</p>
</div>
<div class="s-sim"><div class="rd-shot"><img src="{img('sim')}" alt="The Home simulator: a scripted afternoon, Send now buttons and synthetic camera frames"></div><p class="s-label"><b>mykx-sim.vercel.app</b>, passcode only. Today it plays the phone's places and motion and the home cameras; health and motion peripherals come next, on the same protocol.</p></div>
<svg class="rd-thread" viewBox="0 0 1600 900"><path d="M848 500 C 890 500, 900 470, 944 470"/></svg>
<div class="s-phone"><div class="rd-phone"><img src="{img('phone-home')}" alt="Home now on the parent's phone, read live by Muse Spark"></div><p class="s-label" style="text-align:center"><b>myKx</b>, Home now, live</p></div>
<aside class="s-link"><h3>For a real home: Home Link</h3><p>A small app on the family's computer takes a picture from each camera only when a room changes and sends it to myKx. Camera passwords never leave the computer.</p><div class="rd-shot"><img src="{img('homelink')}" alt="Home Link's settings page on the family's computer"></div></aside>
"""
board("ReadmeSim", "myKx README: the simulator", build_sim, True, sim_css)

# 8. Roadmap --------------------------------------------------------------------------------------------------------
road_css = """
.r-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:62% 50%;opacity:.13}
.r-head{position:absolute;left:88px;top:60px;width:1424px}
.r-head .rd-lede{margin-top:14px;font-size:23px;line-height:33px}
.r-path{position:absolute;left:0;top:0;width:1600px;height:900px}
.r-stops{position:absolute;left:88px;right:88px;top:228px;display:grid;grid-template-columns:repeat(5,1fr);gap:24px}
.r-stop{position:relative;padding-top:64px}
.r-dot{position:absolute;top:0;left:0;width:40px;height:40px;border-radius:50%;background:#1C1B4A;box-shadow:inset 0 0 0 3px #FFE38A}
.r-stop.now .r-dot{background:#FFE38A;box-shadow:0 0 0 8px rgba(255,227,138,.25),0 0 24px rgba(255,227,138,.8)}
.r-when{font:800 17px/22px "Nunito",sans-serif;color:#FFE38A}
.r-stop h3{margin-top:4px;font:600 29px/34px "Fredoka",sans-serif;color:#fff}
.r-stop ul{margin:14px 0 0;padding:0;list-style:none;display:grid;gap:9px}
.r-stop li{position:relative;padding-left:24px;font:700 17px/24px "Nunito",sans-serif;color:#D9D3FF}
.r-stop li svg{position:absolute;left:0;top:6px;width:14px;height:14px;fill:#B9A7F5}
.r-stop .rd-m{margin-top:16px}
.r-ask{position:absolute;left:88px;bottom:40px;font:600 26px/34px "Fredoka",sans-serif;color:#FFE38A}
.r-world{position:absolute;left:88px;right:88px;top:598px;display:grid;grid-template-columns:790px 1fr;gap:28px;padding:20px 28px;border-radius:28px;background:rgba(43,42,92,.82);box-shadow:inset 0 0 0 2px rgba(255,227,138,.55)}
.r-world .r-when{color:#FFE38A}
.r-world h3{margin-top:2px;font:600 28px/34px "Fredoka",sans-serif;color:#fff}
.r-world ul{margin:12px 0 0;padding:0;list-style:none;display:grid;gap:7px}
.r-world li{position:relative;padding-left:24px;font:700 16px/22px "Nunito",sans-serif;color:#D9D3FF}
.r-world li svg{position:absolute;left:0;top:5px;width:14px;height:14px;fill:#FFE38A}
.r-flags{display:grid;grid-template-columns:repeat(5,1fr);gap:10px 8px;align-content:center}
.r-flag{display:flex;flex-direction:column;align-items:center;gap:6px;margin:0}
.r-flag img{width:64px;height:48px;border-radius:8px;box-shadow:0 0 0 1px rgba(255,255,255,.35),0 8px 18px rgba(10,8,40,.4);object-fit:cover}
.r-flag figcaption{font:700 13px/16px "Nunito",sans-serif;color:#D9D3FF;text-align:center}
"""
stop = lambda cls, when, title, items, extra="": f'<div class="r-stop {cls}"><span class="r-dot"></span><div class="r-when">{when}</div><h3>{title}</h3><ul>{"".join(li(i) for i in items)}</ul>{extra}</div>'
build_road = f"""
<img class="r-art" src="{img('hero')}" alt="">
<div class="r-head"><h1 class="rd-h2">Where Kix goes next.</h1><p class="rd-lede">The MVP works end to end in Singapore today. Each next step builds on what's already running. Then Kix goes global.</p></div>
<svg class="r-path" viewBox="0 0 1600 900"><path d="M108 248 C 200 208, 300 288, 398 248 S 590 208, 687 248 S 880 208, 977 248 S 1170 208, 1266 248" fill="none" stroke="#FFE38A" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/></svg>
<div class="r-stops">
{stop("now", "Now", "The MVP, live", ["Learning loops, Treasure, Vibe Zone and Arcade", "A Kix that remembers and sparks", "Guardian, the simulator and Home Link"], muse("mykx.vercel.app"))}
{stop("", "Next", "myKx mobile app", ["Android first, then iPhone", "Precise location from the phone's GPS", "Motion: walking, cycling, playing"])}
{stop("", "Then", "Home Link and devices", ["Live CCTV streams, read at home", "Only changes reach Muse", "Health and motion peripherals on the same protocol"])}
{stop("", "Also", "More to learn and earn", ["Vibe an app in the Vibe Zone, and more STEM games", "A rewards store for stars earned, never real money", "Brand partners for picks the parent approves"])}
{stop("", "Later", "Kix on Meta devices", ["Hands-free, at home and outdoors", "Sees and hears only with permission", "More personal support for every child"])}
</div>
<section class="r-world">
  <div><div class="r-when">Beyond</div><h3>Kix goes global</h3><ul>{"".join(li(i) for i in ["A Curriculum Scout per country maps its syllabus, grades and exams into new skill packs", "A Local Coach agent teaches in the child's language, with local examples, money and places", "Each country's child-privacy law built into the rules (PDPA, COPPA, GDPR and more)"])}</ul></div>
  <div class="r-flags">{"".join(f'<figure class="r-flag"><img src="{img("flag-" + c)}" alt="{n} flag"><figcaption>{n}</figcaption></figure>' for c, n in [("sg", "Singapore"), ("my", "Malaysia"), ("id", "Indonesia"), ("au", "Australia"), ("jp", "Japan"), ("cn", "China"), ("in", "India"), ("kr", "Korea"), ("gb", "UK"), ("us", "USA")])}</div>
</section>
<p class="r-ask">Built in Singapore. Help us take Kix from a hackathon MVP to every family, everywhere.</p>
"""
board("ReadmeRoadmap", "myKx README: roadmap", build_road, True, road_css)

# 9. Feature wall -------------------------------------------------------------------------------------------------
fw_css = """
.f-head{position:absolute;left:88px;top:52px;right:88px;display:flex;justify-content:space-between;align-items:flex-end}
.f-head .rd-lede{width:560px;font-size:21px;line-height:30px;text-align:right}
.f-grid{position:absolute;left:88px;right:88px;top:178px;display:grid;grid-template-columns:repeat(5,1fr);gap:22px 20px}
.f-tile .rd-shot{border-radius:12px}
.f-tile .rd-shot img{aspect-ratio:16/10;object-fit:cover;object-position:50% 0}
.f-tile p{margin-top:9px;font:800 17px/22px "Nunito",sans-serif;color:#F4F1FF}
.f-tile p span{display:block;font:600 14px/19px "Nunito",sans-serif;color:#B8B2E8}
"""
tiles = [
    ("jordan-studio", "Sidekick Studio", "Kix transforms into your world"), ("jordan-home", "Junior home", "Today's quest and Kix"), ("jordan-learn", "Quest map", "Mastery you can see"), ("jordan-spark", "Question player", "Hints, voice and sparks"), ("jordan-treasure", "Treasure Realm", "Cards you earn, never buy"),
    ("jordan-critters", "Critter Lab", "Real life cycles, raised"), ("jordan-squadron", "Sky Squadron", "Jets earned with fresh questions"), ("jordan-arcade", "Arcade", "Typing games on one engine"), ("leonard-neon", "Neon Strike", "Science words at speed"), ("abby-home", "Teen study deck", "Exam-week focus"),
    ("parent-today", "Parent Today", "Flags with the evidence"), ("admin-skills", "Skills admin", "Seven packs, versioned"), ("parent-home", "Home now", "Cameras read by Muse"), ("parent-together", "Do together", "Weekend ideas, sourced"), ("admin-hood", "Under the hood", "Every model call, logged"),
]
tiles_html = "".join(f'<figure class="f-tile" style="margin:0"><div class="rd-shot"><img src="{img(k)}" alt="{t}"></div><p>{t}<span>{d}</span></p></figure>' for k, t, d in tiles)
build_fw = f"""
<div class="f-head"><h1 class="rd-h2">A working MVP, end to end.</h1><p class="rd-lede">Every screen here is the real app, signed in as the sample family. Seven skill packs, three age bands, five worlds.</p></div>
<div class="f-grid">{tiles_html}</div>
"""
board("ReadmeFeatures", "myKx README: feature wall", build_fw, True, fw_css)

# 10. The door (design inspiration) --------------------------------------------------------------------------------
door_css = """
.d-copy{position:absolute;left:88px;top:76px;width:470px}
.d-copy .rd-lede{margin-top:22px;font-size:22px;line-height:33px}
.d-grid{position:absolute;left:606px;right:88px;top:76px;display:grid;grid-template-columns:repeat(2,1fr);gap:26px 24px}
.d-step .rd-shot{border-radius:14px}
.d-step .rd-shot img{aspect-ratio:16/10;object-fit:cover}
.d-step p{display:flex;gap:12px;align-items:baseline;margin-top:12px;font:700 18px/25px "Nunito",sans-serif;color:#D9D3FF}
.d-step p b{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#FFE38A;color:#1C1B4A;font:800 16px/1 "Nunito",sans-serif}
"""
steps = [("door-0", "A grand door in a twilight city welcomes every visitor."), ("door-1", "Kix asks the child for their magic name."), ("door-3", "Their own door flies in as their world spreads over the city."), ("door-5", "Their door asks for their picture code or password.")]
steps_html = "".join(f'<figure class="d-step" style="margin:0"><div class="rd-shot"><img src="{img(k)}" alt="{html.escape(t)}"></div><p><b>{n}</b>{t}</p></figure>' for n, (k, t) in enumerate(steps, 1))
build_door = f"""
<div class="d-copy">
  <h1 class="rd-h2">A world before the first question.</h1>
  <p class="rd-lede">Most learning apps open on a login form. myKx opens on a grand door. A child says their magic name and their own door flies in, while their world spreads over the city: petals for Anime Sky, confetti for Idol Stage, leaves for the Terrarium. It's theirs before they've typed a thing.</p>
  <p class="rd-lede">Inside, every screen wears that world, and the sounds are synthesised in its instruments.</p>
</div>
<div class="d-grid">{steps_html}</div>
"""
board("ReadmeDoor", "myKx README: the door", build_door, True, door_css)

# 11. Kix gets better every day -------------------------------------------------------------------------------------
grow_css = """
.g-head{position:absolute;left:88px;top:68px;width:1420px;display:flex;justify-content:space-between;align-items:flex-end;gap:40px}
.g-head .rd-lede{width:600px;font-size:22px;line-height:32px}
.g-cols{position:absolute;left:88px;right:88px;top:262px;bottom:56px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.g-col{border-radius:26px;background:#2B2A5C;padding:16px 16px 18px;display:flex;flex-direction:column}
.g-crop{position:relative;height:260px;border-radius:14px;overflow:hidden;background:#0F0E2A;box-shadow:0 0 0 1px rgba(185,167,245,.35)}
.g-crop img{position:absolute;display:block}
.g-col h3{margin-top:16px;font:600 26px/31px "Fredoka",sans-serif;color:#FFE38A}
.g-col p{margin-top:8px;font:700 17px/24px "Nunito",sans-serif;color:#D9D3FF;flex:1}
.g-col .rd-chips{margin-top:12px}
"""
def gcol(key, title, text, chips, crop):
    return f'<section class="g-col"><div class="g-crop"><img src="{img(key)}" alt="" style="{crop}"></div><h3>{title}</h3><p>{text}</p><div class="rd-chips">{chips}</div></section>'
build_grow = f"""
<div class="g-head">
  <h1 class="rd-h2" style="width:720px">Kix gets better<br>every day.</h1>
  <p class="rd-lede">After every session, Muse Spark writes down what Kix learned about the child, and tomorrow uses it. Every week, new exam papers sharpen the skill packs. Plain code decides when; Muse finds the words.</p>
</div>
<div class="g-cols">
{gcol("jordan-home", "Remembers yesterday", "A hard session yesterday? Today starts gently, with a warm-up they already know and softer hints. Kix never says why.", muse("Memory Keeper") + rules(), "width:847px;left:-65px;top:-259px")}
{gcol("jordan-spark", "Sparks a drifting mind", "Quiet for a while, or guessing fast? Kix ties what they love (critters, jets, anime, K-pop) to the question. A focus dip brings a fact and a place to go, or a dance break.", muse("Kix Tutor"), "width:787px;left:-437px;top:-16px")}
{gcol("parent-notebook", "Knows the child", "Kix's Notebook keeps how they ask, the slips they make and their best moments, from their own words. A parent can read, edit or wipe every line.", muse("Memory Keeper"), "width:612px;left:-60px;top:0")}
{gcol("admin-skills", "Learns new exams", "Every week the scout finds new papers, the Content Curator reads their patterns and the Skill Editor drafts improvements. An admin publishes a version.", muse("Content Curator") + muse("Skill Editor"), "width:612px;left:-30px;top:0")}
</div>
"""
board("ReadmeGrows", "myKx README: Kix gets better every day", build_grow, True, grow_css)

print("boards written")
