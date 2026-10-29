#!/usr/bin/env python3
# Kix Synapse design boards (canvas page "Kix Synapse, 29 Oct"; spec docs/prd/SYNAPSE.md). Run from a folder that holds
# canvas-root/project (or set CANVAS_OUT). Sample data only: learners show as level, never a name.
import os, html

OUT = os.environ.get("CANVAS_OUT") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "canvas-root", "project")
B = {
    "q": "a731cc9b4c7ef7ec8b04bdb9fb5302ed", "hero": "82decf82e608e07ac43d134a4688bc09", "wmLight": "f52e18857979369421011da66fdb9de3",
    "wmDark": "86d2ad40444eabc4ba4c8a0e9f1d4603", "idle": "02f791d67e720a2bf4fdb268ff6b6b8a", "think": "322dfed5486a583d4343e28bcb22c301",
    "cheer": "f506e58a602297834bce49cc9565bca7",
}
img = lambda k: f"/_blob/{B[k]}"

def ico(d, size=18, fill=False, sw=2.2):
    paint = 'fill="currentColor"' if fill else f'fill="none" stroke="currentColor" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"'
    return f'<svg viewBox="0 0 24 24" aria-hidden="true" style="width:{size}px;height:{size}px;flex:none"><path {paint} d="{d}"/></svg>'

FLAG = "M6 21V4M6 4.5h11.5l-2.6 4 2.6 4H6"
SPARK = "M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z"
LOCK = "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3"
CHECK = "M5 12.5l4.5 4.5L19 7.5"
CROSS = "M6 6l12 12M18 6L6 18"
MIC = "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"
TYPO = "M3 18l5-12 5 12M5 14h6M14.5 18c1.2-1.6 2.4-1.6 3.5 0s2.3 1.6 3.5 0"
MARK = "M4 12.5l4 4 8-9M15 15.5l5 5M20 15.5l-5 5"
PIC = "M3.5 5h17v14h-17zM3.5 15.5l5-4.5 4 3.5 3-2.5 5 4M15.5 9.5h.01"
BULB = "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"
QUES = "M9.2 9a3 3 0 1 1 4.3 2.7c-.9.4-1.5 1.2-1.5 2.2v.6M12 18h.01"
DOTS = "M6 12h.01M12 12h.01M18 12h.01"
UNDO = "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
GEAR = "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2l-.3 2h-4l-.3-2a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.7a7 7 0 0 1 2-1.2l.3-2h4l.3 2a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z"

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
# 1. The flag, kid side (1600x1000): Junior on a Learn question, Teen on an Ask Kix reply, and the outcomes.
INK = "#2A1E5C"
fl_css = """
.bd{background:#16143E}
.hd{position:absolute;left:40px;top:26px;right:40px;display:flex;justify-content:space-between;align-items:flex-end;gap:40px}
.hd h1{font:600 30px/36px var(--font-display);color:#fff}
.hd p{font:700 15px/22px var(--font-text);color:#D9D3FF;max-width:640px;text-align:right}
.fr{position:absolute;border-radius:22px;overflow:hidden;box-shadow:0 0 0 1px rgba(185,167,245,.3)}
.cap{position:absolute;left:14px;top:12px;z-index:9;display:flex;align-items:center;gap:8px;padding:5px 12px 5px 6px;border-radius:999px;background:rgba(22,20,62,.82);color:#fff;font:800 14px/18px var(--font-text)}
.cap b{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#FFE38A;color:#1C1B4A;font:800 13px/1 var(--font-text)}
.stage{position:absolute;left:0;top:0;width:1440px;height:900px;transform:translate(28px,44px) scale(.6722);transform-origin:0 0}
.stage>img{position:absolute;inset:0;width:1440px;height:900px}
.stage{border-radius:26px;overflow:hidden;box-shadow:0 0 0 3px rgba(42,30,92,.18),0 20px 50px rgba(42,30,92,.18)}
.fbtn{position:absolute;left:744px;top:191px;width:50px;height:50px;border-radius:50%;display:grid;place-items:center;background:#7C5CFF;color:#fff;box-shadow:0 0 0 3px #2A1E5C,0 0 0 9px rgba(124,92,255,.28),0 0 28px 10px rgba(255,126,182,.55)}
.fp{position:absolute;left:918px;top:104px;width:492px;height:748px;border-radius:30px;background:#fff;box-shadow:0 0 0 3px #2A1E5C,0 9px 0 #2A1E5C;padding:22px 22px 18px;display:flex;flex-direction:column;gap:14px;font-family:Nunito,var(--font-text);color:#2A1E5C}
.fp-top{display:flex;gap:12px;align-items:center}
.fp-top img{width:74px;height:74px;border-radius:50%;object-fit:cover;background:#F1ECFF;box-shadow:0 0 0 3px #2A1E5C}
.fp h2{font:400 34px/38px 'Lilita One',var(--font-display);letter-spacing:.2px}
.fp-sub{font:700 17px/23px Nunito,var(--font-text);color:#5B5180}
.chips{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.kc{display:flex;align-items:center;gap:10px;min-height:78px;padding:10px 12px;border-radius:18px;background:#FFF6E0;box-shadow:inset 0 0 0 2.5px #EADDB5;font:800 18px/22px Nunito,var(--font-text)}
.kc .i{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:#fff;box-shadow:inset 0 0 0 2px #EADDB5;flex:none}
.kc.on{background:#7C5CFF;color:#fff;box-shadow:inset 0 0 0 3px #2A1E5C,0 4px 0 #2A1E5C}
.kc.on .i{background:rgba(255,255,255,.18);box-shadow:none}
.lbl{font:800 17px/22px Nunito,var(--font-text)}
.lbl small{font-weight:700;color:#7A719C}
.note{display:flex;gap:10px;align-items:stretch}
.mic{width:76px;flex:none;border-radius:20px;background:#7C5CFF;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:800 11px/13px Nunito,var(--font-text);box-shadow:0 0 0 3px #2A1E5C}
.said{flex:1;border-radius:18px;background:#FFF6E0;box-shadow:inset 0 0 0 2.5px #EADDB5;padding:10px 12px;font:700 18px/24px Nunito,var(--font-text)}
.said .ok{display:flex;gap:14px;margin-top:6px;font:800 15px/18px Nunito,var(--font-text);color:#4F3FB8}
.send{height:68px;border-radius:999px;background:#FFD23F;box-shadow:inset 0 0 0 3px #2A1E5C,0 5px 0 #2A1E5C;display:flex;align-items:center;justify-content:center;gap:10px;font:900 19px/1 Nunito,var(--font-text)}
.fine{display:flex;gap:8px;align-items:flex-start;font:700 15px/20px Nunito,var(--font-text);color:#6A6190}
.strip{position:absolute;left:40px;top:772px;width:1040px;bottom:28px;display:flex;flex-direction:column;gap:12px}
.strip h3{font:800 15px/20px var(--font-text);color:#FFE38A}
.pills{display:flex;flex-wrap:wrap;gap:8px}
.pill{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 11px;border-radius:999px;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(185,167,245,.35);color:#EDE9FF;font:700 13.5px/1 var(--font-text)}
.pill b{color:#fff}
.pill.r{background:rgba(255,227,138,.12);box-shadow:inset 0 0 0 1px rgba(255,227,138,.45)}
.tb{left:1100px;top:104px;width:460px;height:392px;background:linear-gradient(180deg,#DCEBFF,#F8FAFF 70%);font-family:Nunito,var(--font-text);color:#1B2350}
.rep{position:absolute;left:22px;top:50px;right:22px;border-radius:18px;background:#fff;box-shadow:inset 0 0 0 2px #1B2350;padding:14px 16px}
.rep h4{margin:0;font:800 15px/20px Nunito,var(--font-text);display:flex;gap:8px;align-items:center}
.rep ol{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
.rep li{display:flex;gap:8px;font:700 14px/19px Nunito,var(--font-text)}
.rep li span.n{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#E3EEFF;font:800 12px/1 Nunito;flex:none}
.rep li.bad b{text-decoration:underline wavy #E5484D;text-underline-offset:4px}
.tflag{position:absolute;right:12px;top:10px;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#1B2350;color:#fff;box-shadow:0 0 0 6px rgba(90,169,240,.35)}
.pop{position:absolute;left:44px;right:22px;top:196px;border-radius:18px;background:#fff;box-shadow:0 0 0 2px #1B2350,0 18px 34px rgba(27,35,80,.25);padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.pop:before{content:"";position:absolute;right:30px;top:-9px;width:16px;height:16px;background:#fff;transform:rotate(45deg);box-shadow:-2px -2px 0 0 #1B2350}
.pop h4{margin:0;font:800 16px/20px Nunito,var(--font-text)}
.tc{display:flex;flex-wrap:wrap;gap:6px}
.tc span{height:34px;padding:0 12px;border-radius:999px;display:inline-flex;align-items:center;font:800 13px/1 Nunito;box-shadow:inset 0 0 0 2px #C9D7F2}
.tc span.on{background:#1B2350;color:#fff;box-shadow:none}
.tin{display:flex;gap:8px;align-items:center}
.tin div{flex:1;height:40px;border-radius:12px;box-shadow:inset 0 0 0 2px #C9D7F2;padding:0 12px;display:flex;align-items:center;font:700 13.5px/1 Nunito}
.tin b{height:40px;padding:0 16px;border-radius:999px;background:#5AA9F0;color:#fff;display:inline-flex;align-items:center;gap:6px;font:800 14px/1 Nunito}
.tfine{font:700 12px/16px Nunito;color:#55608C}
.oc{left:1100px;top:512px;width:460px;bottom:28px;background:radial-gradient(120% 90% at 80% 0%,#3B3A7A 0%,#22214F 60%);padding:48px 16px 14px;display:flex;flex-direction:column;gap:8px}
.oc>*{flex:none}
.chk{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px;border-radius:999px;background:#FFF1D6;color:#8A5A00;font:800 13px/1 var(--font-text)}
.chk i{width:8px;height:8px;border-radius:50%;background:#F2A93B;box-shadow:0 0 0 4px rgba(242,169,59,.25)}
.on1{border-radius:20px;background:#fff;padding:10px 14px;display:grid;grid-template-columns:50px 1fr;gap:12px;align-items:start;color:#1C1B4A}
.on1 img{width:50px;height:50px;border-radius:50%;object-fit:cover;background:#EDE9FF}
.on1 h4{margin:0;font:600 18px/22px var(--font-display)}
.on1 p{margin:3px 0 0;font:700 13px/18px var(--font-text);color:#3D3A6B}
.on1 .ft{display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap}
.dif{display:inline-flex;gap:6px;align-items:center;font:800 13px/1 var(--font-text)}
.dif s{color:#A21C1C;background:#FDE8E8;padding:3px 6px;border-radius:6px}
.dif ins{text-decoration:none;color:#1F5E37;background:#E6F6EA;padding:3px 6px;border-radius:6px}
.okc{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;background:#DDF3E4;color:#1F5E37;font:800 12px/1 var(--font-text)}
.on1.lav{background:#EDE9FF}
.got{height:30px;padding:0 14px;border-radius:999px;background:#2B2A5C;color:#fff;display:inline-flex;align-items:center;font:800 13px/1 var(--font-text)}
"""
def kchip(i, label, on=False):
    return f'<div class="kc{" on" if on else ""}"><span class="i">{ico(i, 22)}</span>{label}</div>'

fl = f"""
<div class="hd"><h1>Flag it: kids tell Kix what's wrong</h1><p>One tap on any screen where AI speaks or marks. The kid picks what's wrong, can say a few words, and hears back: fixed, or why Kix was right.</p></div>
<div class="fr" style="left:40px;top:104px;width:1040px;height:650px;background:#FFF6E0">
 <div class="cap"><b>1</b>Junior · a Learn question</div>
 <div class="stage" data-theme="toon-pop">
  <img src="{img("q")}" alt="">
  <div class="fbtn">{ico(FLAG, 26, sw=2.6)}</div>
  <div class="fp">
   <div class="fp-top"><img src="{img("think")}" alt=""><div><h2>What's not right?</h2><p class="fp-sub">Tell Kix's crew. They check every report.</p></div></div>
   <div class="chips">{kchip(TYPO, "A word is spelt wrong")}{kchip(MARK, "My answer was marked wrong")}{kchip(PIC, "The picture doesn't match")}{kchip(BULB, "The hint didn't help")}{kchip(QUES, "The question looks wrong", True)}{kchip(DOTS, "Something else")}</div>
   <div class="lbl">Tell Kix more <small>(you can skip this)</small></div>
   <div class="note"><div class="mic">{ico(MIC, 26)}Hold<br>to talk</div><div class="said">"Two answers say larva and pupa. Frogs don't have those!"<div class="ok"><span>{ico(CHECK, 14, sw=3)} That's right</span><span>{ico(UNDO, 14)} Say it again</span></div></div></div>
   <div class="send">{ico(FLAG, 22, sw=2.6)}Send to Kix's crew</div>
   <div class="fine">{ico(LOCK, 15)}<span>Kix's crew sees this question and what you said. Not your other chats.</span></div>
  </div>
 </div>
</div>
<div class="strip">
 <h3>The flag is on every screen where AI speaks or marks</h3>
 <div class="pills"><span class="pill"><b>Learn</b> question, marking, hint</span><span class="pill"><b>Ask Kix</b> every reply</span><span class="pill"><b>Talk to Kix</b></span><span class="pill"><b>Critter Lab</b> what the pet says</span><span class="pill"><b>Vibe Zone</b> cards</span><span class="pill"><b>Parent</b> Tonight, Kix's ideas</span></div>
 <div class="pills"><span class="pill r">No points or stars for reports</span><span class="pill r">10 a day, one open report per question</span><span class="pill r">Upset words go to Kix's caring reply first</span><span class="pill r">Bottom sheet on phones</span></div>
</div>
<div class="fr tb">
 <div class="cap"><b>2</b>Teen · an Ask Kix reply</div>
 <div class="rep"><h4>Steps <span style="font:700 12px Nunito;color:#55608C">2 of 3</span></h4>
  <ol><li><span class="n">1</span><span>Before: A = 3u, B = 1u, total = 4u</span></li><li><span class="n">2</span><span>85 move: A = 3u − 85, B = 1u + 85</span></li><li class="bad"><span class="n">3</span><span><b>Total after: 4u − 20 = 180</b></span></li></ol>
  <div class="tflag">{ico(FLAG, 20, sw=2.6)}</div></div>
 <div class="pop"><h4>What's off?</h4>
  <div class="tc"><span class="on">Answer looks wrong</span><span>Typo</span><span>Doesn't make sense</span><span>Something else</span></div>
  <div class="tin"><div>Step 3 changes the total. It should stay the same.</div><b>{ico(FLAG, 15, sw=2.6)}Send</b></div>
  <p class="tfine">Kix's crew sees only this reply and your question.</p></div>
</div>
<div class="fr oc">
 <div class="cap"><b>3</b>What comes back</div>
 <span class="chk"><i></i>Checking… Kix's crew has it</span>
 <div class="on1"><img src="{img("cheer")}" alt=""><div><h4>Fixed, thanks to you!</h4><p>The question said Tank C, but the picture shows Tank B. It's fixed for every P6 kid now.</p><div class="ft"><span class="dif"><s>Tank C</s>→<ins>Tank B</ins></span><span class="okc">{ico(CHECK, 13, sw=3)}Fixed by your report</span></div></div></div>
 <div class="on1"><img src="{img("cheer")}" alt=""><div><h4>Your answer counts now</h4><p>1/4 and 0.25 are the same number. Kix's crew fixed the marking, so your answer is right.</p></div></div>
 <div class="on1 lav"><img src="{img("idle")}" alt=""><div><h4>Kix double-checked</h4><p>Good eye! Larva and pupa are insect stages, not frog stages. That answer is there to check you know the difference.</p><div class="ft"><span class="got">Got it</span></div></div></div>
</div>"""
board("SynapseFlag", "Kix Synapse: kids flag what's wrong", 1600, 1000, "dreamlight", fl, fl_css)

# ---------------------------------------------------------------------------------------------------------------------
# 2. The brand board (1600x900): Kix Synapse and its loop, for the README and the video.
lp_css = """
.bd{background:#16143E;color:#fff}
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.scr{position:absolute;inset:0;background:linear-gradient(90deg,rgba(18,16,52,.94) 0%,rgba(18,16,52,.78) 38%,rgba(18,16,52,0) 66%),linear-gradient(0deg,rgba(14,12,44,.92) 0%,rgba(14,12,44,0) 42%)}
.lk{position:absolute;left:72px;top:72px;width:700px}
.lk .k{display:flex;align-items:center;gap:14px;color:#FFE38A;font:800 18px/1 var(--font-text)}
.lk h1{margin-top:18px;font:600 92px/92px var(--font-display);letter-spacing:-1px;color:#fff}
.lk h1 span{display:block;font:600 30px/36px var(--font-display);letter-spacing:0;color:#B9A7F5;margin-top:10px}
.lk p{margin-top:26px;font:700 25px/35px var(--font-text);color:#EDE9FF;max-width:600px}
.path{position:absolute;left:0;right:0;bottom:0;height:300px}
.path svg{position:absolute;inset:0;width:100%;height:100%}
.nd{position:absolute;width:210px;transform:translateX(-50%);text-align:center}
.nd i{display:block;margin:0 auto 12px;width:26px;height:26px;border-radius:50%;background:#FFE38A;box-shadow:0 0 0 6px rgba(255,227,138,.22),0 0 30px 8px rgba(255,227,138,.55)}
.nd b{display:block;font:600 26px/30px var(--font-display);color:#fff}
.nd small{display:block;margin-top:6px;font:700 15px/20px var(--font-text);color:#D9D3FF}
.nd.next i{background:transparent;box-shadow:inset 0 0 0 3px #B9A7F5,0 0 0 6px rgba(185,167,245,.15)}
.nd.next b{color:#B9A7F5}
.st{position:absolute;right:56px;top:64px;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.st span{display:inline-flex;gap:8px;align-items:center;height:34px;padding:0 14px;border-radius:999px;background:rgba(18,16,52,.62);box-shadow:inset 0 0 0 1px rgba(185,167,245,.4);font:700 14px/1 var(--font-text);color:#EDE9FF}
.st span b{color:#FFE38A}
.st em{font:700 12px/1 var(--font-text);color:#9C94D0;font-style:normal}
"""
NODES = [(170, "Flag", "Kids tap the flag on any AI screen"), (430, "Trace", "Every call: model, version, guard, cost"),
         (690, "Review", "Muse Spark Open, Meta's open weights"), (950, "Fix", "Skill versions and learned cautions"),
         (1210, "Re-test", "Reproduce, fix, prove; nightly evals")]
lp = f"""<img class="bg" src="{img("hero")}" alt=""><div class="scr"></div>
<div class="lk"><div class="k">{ico(SPARK, 22, fill=True)}The self-learning engine inside myKx</div><h1>Kix Synapse<span>Kix learns from every flag</span></h1>
<p>Kids say when something's wrong. Synapse reproduces it, reviews it and ships the fix only when it can prove it. People decide the rest.</p></div>
<div class="st"><span><b>21 of 37</b> reports fixed this week by Synapse</span><span>median <b>1 min 48 s</b> from flag to fix</span><span><b>118 / 120</b> evals passing</span><em>Sample numbers</em></div>
<div class="path"><svg viewBox="0 0 1600 300" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="g"><feGaussianBlur stdDeviation="5"/></filter></defs>
<path d="M60 92 C 300 40, 560 140, 820 92 S 1280 40, 1470 92" fill="none" stroke="#FFE38A" stroke-width="8" opacity=".35" filter="url(#g)"/>
<path d="M60 92 C 300 40, 560 140, 820 92 S 1280 40, 1470 92" fill="none" stroke="#FFE38A" stroke-width="2.5" stroke-dasharray="0" opacity=".9"/>
<path d="M1300 70 C 1380 60, 1430 80, 1470 92" fill="none" stroke="#B9A7F5" stroke-width="2.5" stroke-dasharray="6 7"/></svg>
{"".join(f'<div class="nd" style="left:{x}px;top:{80 if i % 2 == 0 else 74}px"><i></i><b>{n}</b><small>{d}</small></div>' for i, (x, n, d) in enumerate(NODES))}
<div class="nd next" style="left:1440px;top:80px"><i></i><b>Retrain</b><small>Next: a myKx model of its own</small></div></div>"""
board("SynapseLoop", "Kix Synapse: the self-learning engine", 1600, 900, "dreamlight", lp, lp_css)

# ---------------------------------------------------------------------------------------------------------------------
# Admin shell (anime-sky tokens, as the other admin boards)
ad_css = """
.bd{background:var(--surface)}
.ad-nav{position:absolute;left:0;top:0;bottom:0;width:220px;padding:22px 14px;box-shadow:inset -1px 0 0 var(--line);display:flex;flex-direction:column;gap:4px}
.ad-nav img{height:30px;align-self:flex-start;margin:0 8px 16px}
.ad-nav a{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:12px;color:var(--ink-muted);font:700 14px var(--font-text)}
.ad-nav a.on{background:var(--surface-raised);color:var(--ink);box-shadow:inset 3px 0 0 var(--accent)}
.ad-nav a .new{margin-left:auto;font:800 10px/1 var(--font-text);padding:3px 6px;border-radius:999px;background:#FFE38A;color:#1C1B4A}
.ad-main{position:absolute;left:220px;right:0;top:0;bottom:0;padding:22px 28px}
.ad-h1{font:800 26px/32px var(--font-display)}
.ad-sub{margin-top:4px;font:600 14px/20px var(--font-text);color:var(--ink-muted)}
.chip{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;font:800 12px/1 var(--font-text);white-space:nowrap}
.c-ok{background:#DDF3E4;color:#1F5E37}.c-wait{background:#FFF1D6;color:#8A5A00}.c-def{background:#E8E6F7;color:#3B3780}.c-flag{background:#FFE3E3;color:#A21C1C}.c-open{background:#2B2A5C;color:#FFE38A}.c-team{background:#E3EEFF;color:#1F4E8C}
.btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:999px;font:800 13px var(--font-text);white-space:nowrap}
.b-pri{background:var(--accent);color:var(--on-accent)}.b-sec{box-shadow:inset 0 0 0 2px var(--line);color:var(--ink)}.b-del{color:#A21C1C;box-shadow:inset 0 0 0 2px #F3C4C4}
.card{border-radius:20px;background:var(--surface-raised);box-shadow:inset 0 0 0 1px var(--line);padding:16px}
.h2{font:800 16px/22px var(--font-display)}
.mono{font:500 12.5px/20px ui-monospace,SFMono-Regular,Menlo,monospace}
.sub{display:flex;gap:4px;margin-top:14px}
.sub span{padding:7px 14px;border-radius:999px;font:800 13px var(--font-text);color:var(--ink-muted)}
.sub span.on{background:var(--ink);color:var(--surface)}
.mt{position:relative;height:8px;border-radius:999px;background:var(--line)}
.mt i{position:absolute;left:0;top:0;bottom:0;border-radius:999px}
.mt b{position:absolute;top:-4px;width:2px;height:16px;background:var(--ink)}
"""
SUBNAV = lambda on: '<div class="sub">' + "".join(f'<span class="{"on" if n == on else ""}">{n}</span>' for n in ["Inbox", "Learned", "Evals", "Settings", "Retrain"]) + "</div>"
NAV = lambda: f'<nav class="ad-nav"><img src="{img("wmLight")}" alt="myKx">' + "".join(f'<a class="{"on" if n == "Kix Synapse" else ""}">{ico(SPARK, 13, fill=True) if n == "Kix Synapse" else ""}{n}{"<span class=new>New</span>" if n == "Kix Synapse" else ""}</a>' for n in ["Skills", "Add knowledge", "People", "Under the hood", "Kix Synapse"]) + "</nav>"

def meter(v, color="#7C5CFF", thr=100, w=120):
    return f'<div class="mt" style="width:{w}px"><i style="width:{v}%;background:{color}"></i><b style="left:calc({thr}% - 1px)"></b></div>'

# 3. Inbox (1440x900)
ib_css = ad_css + """
.lp{margin-top:16px;border-radius:22px;background:radial-gradient(90% 140% at 85% 0%,#3B3A7A 0%,#1B2350 62%);color:#fff;padding:18px 22px;display:grid;grid-template-columns:1fr 230px;gap:22px}
.stg{display:flex;align-items:center}
.sg{flex:1;min-width:0}
.sg{white-space:nowrap}
.sg b{display:block;font:600 34px/38px var(--font-display);color:#fff}
.sg span{display:block;font:800 13px/18px var(--font-text);color:#FFE38A}
.sg small{display:block;font:700 12px/16px var(--font-text);color:#C9C3F0}
.ar{flex:none;width:30px;height:2px;margin:0 10px;background:linear-gradient(90deg,rgba(255,227,138,.2),#FFE38A);position:relative}
.ar:after{content:"";position:absolute;right:-1px;top:-4px;border-left:8px solid #FFE38A;border-top:5px solid transparent;border-bottom:5px solid transparent}
.wt{border-radius:16px;background:#FFE38A;color:#1C1B4A;padding:12px 14px;display:flex;flex-direction:column;justify-content:center}
.wt b{font:600 30px/32px var(--font-display)}
.wt span{font:800 13px/18px var(--font-text)}
.tbl{margin-top:14px;padding:6px 16px}
.tr{display:grid;grid-template-columns:minmax(0,1.6fr) 150px 160px 220px 210px 60px;gap:14px;align-items:center;padding:11px 0;border-top:1px solid var(--line);font:700 13.5px/18px var(--font-text)}
.tr:first-child{border-top:0;font:800 12px/16px var(--font-text);color:var(--ink-muted);padding:8px 0}
.tr small{display:block;font:700 12px/16px var(--font-text);color:var(--ink-muted)}
.cf{display:flex;align-items:center;gap:8px;font:800 13px var(--font-text)}
.ft2{margin-top:10px;font:700 12.5px/18px var(--font-text);color:var(--ink-muted);display:flex;gap:8px;align-items:center}
"""
STAGES = [("Flagged", "37", "by kids and parents"), ("Traced", "37", "the turn they saw"), ("Reviewed", "35", "Muse Spark Open"), ("Fixed", "21", "17 Synapse · 4 you"), ("Re-tested", "21/21", "green after the fix")]
ROWS = [
    ("Step 3 changes the total", "Ask Kix · P6 Maths", "Kix's reply", "Muse Spark Open", 90, "#F2A93B", '<span class="chip c-wait">Waiting: caution for Ask Kix</span>', "19:44"),
    ("0.25 marked wrong, I wrote 1/4", "Learn · P6 Maths", "Marking", "Open + Spark 1.3", 96, "#F2A93B", '<span class="chip c-wait">Waiting: changes a score</span>', "18:10"),
    ("Tank C in the question, Tank B in the picture", "Learn · P6 Maths", "Figure", "Muse Spark Open", 100, "#2E9E5B", '<span class="chip c-ok">Fixed: P6 Maths v1.4</span>', "17:52"),
    ("'recieve' is spelt wrong", "Learn · P3 English", "Typo", "Muse Spark Open", 100, "#2E9E5B", '<span class="chip c-ok">Fixed: P3 English v1.3</span>', "16:20"),
    ("Bloop said tadpoles eat flies", "Critter Lab · tadpole", "Pet's reply", "Muse Spark Open", 100, "#2E9E5B", '<span class="chip c-ok">Fixed: caution for Critter Keeper</span>', "15:02"),
    ("Larva and pupa aren't frog stages", "Learn · P3 Science", "Question", "Muse Spark Open", 100, "#7C5CFF", '<span class="chip c-def">Kix was right: explained</span>', "14:31"),
    ("The card text is cut off", "Vibe Zone", "App", "Muse Spark Open", 0, "#999", '<span class="chip c-team">For the team</span>', "12:05"),
    ("Tonight says 4 sessions, she did 3", "Parent · Tonight", "Parent's report", "Muse Spark Open", 72, "#F2A93B", '<span class="chip c-wait">Waiting: unclear</span>', "09:15"),
]
ib = f"""{NAV()}
<main class="ad-main">
 <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px"><div><h1 class="ad-h1">Kix Synapse</h1><p class="ad-sub">Kids flag what's wrong. Synapse reproduces it, reviews it with Muse Spark Open and ships the fixes it can prove. The rest wait for you.</p></div>
 <div style="display:flex;gap:8px;align-items:center"><span class="chip c-open">{ico(SPARK, 12, fill=True)}Auto-fix at 100</span><span class="btn b-sec">{ico(GEAR, 16)}Settings</span></div></div>
 {SUBNAV("Inbox")}
 <div class="lp"><div class="stg">{'<span class="ar"></span>'.join(f'<div class="sg"><span>{n}</span><b>{v}</b><small>{d}</small></div>' for n, v, d in STAGES)}</div>
  <div class="wt"><b>4</b><span>waiting for you · median flag to fix 1 min 48 s</span></div></div>
 <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px"><div class="sub" style="margin:0"><span>Waiting for you 4</span><span>Fixed by Synapse 17</span><span>Approved 4</span><span>Kix was right 9</span><span>For the team 1</span><span class="on">All 37</span></div><span class="ad-sub" style="margin:0">This week</span></div>
 <div class="card tbl"><div class="tr"><span>Report</span><span>Kind</span><span>Reviewed by</span><span>Confidence (needs 100)</span><span>Outcome</span><span>When</span></div>
 {"".join(f'<div class="tr"><span>{t}<small>{w}</small></span><span>{k}</span><span>{m}</span><span class="cf">{meter(v, c) if v else "<span style=color:var(--ink-muted)>not scored</span>"}{v if v else ""}</span><span>{o}</span><span>{tm}</span></div>' for t, w, k, m, v, c, o, tm in ROWS)}
 </div>
 <p class="ft2">{ico(LOCK, 14)}Learners show as their level only. A report shares only the turn it's about; nicknames are replaced before any review.</p>
</main>"""
board("SynapseInbox", "Kix Synapse: inbox", 1440, 900, "anime-sky", ib, ib_css)

# 4. A case: trace, review, fix, test, decide (1440x900)
cs_css = ad_css + """
.cg{position:absolute;left:28px;right:28px;top:150px;bottom:22px;display:grid;grid-template-columns:330px minmax(0,1fr) 300px;gap:14px}
.tl{list-style:none;margin:10px 0 0;padding:0;position:relative}
.tl:before{content:"";position:absolute;left:7px;top:8px;bottom:8px;width:2px;background:var(--line)}
.tl li{position:relative;padding:0 0 11px 26px;font:700 12.5px/17px var(--font-text)}
.tl li i{position:absolute;left:1px;top:3px;width:14px;height:14px;border-radius:50%;box-shadow:0 0 0 3px var(--surface-raised)}
.tl li em{font-style:normal;font:800 11px/16px var(--font-text);color:var(--ink-muted);margin-right:6px}
.tl li small{display:block;font:600 11.5px/16px var(--font-text);color:var(--ink-muted)}
.k-kid{background:#5AA9F0}.k-ai{background:#7C5CFF}.k-guard{background:#F2A93B}.k-dec{background:#2E9E5B}.k-rep{background:#E5484D}
.mid{display:flex;flex-direction:column;gap:12px;min-height:0}
.saw{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:12px}
.mini{border-radius:14px;box-shadow:inset 0 0 0 2px #1B2350;padding:10px 12px;font:700 12.5px/18px var(--font-text);background:#fff;color:#1B2350}
.mini ol{margin:6px 0 0;padding-left:18px}
.mini li.bad{text-decoration:underline wavy #E5484D;text-underline-offset:3px}
.rpt{border-radius:14px;background:#FFF1F1;padding:10px 12px;font:700 13px/18px var(--font-text);color:#7A1D1D}
.verdict p{margin-top:6px;font:600 13.5px/20px var(--font-text)}
.cau{margin-top:8px;border-radius:12px;background:#0F1430;color:#DCE3FF;padding:10px 12px}
.cau b{color:#FFE38A;font-weight:600}
.tst{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:8px}
.tst div{border-radius:12px;padding:10px 12px;font:800 13px/18px var(--font-text)}
.tst small{display:block;font:700 11.5px/16px var(--font-text);opacity:.8}
.big{font:600 52px/52px var(--font-display)}
.bk{list-style:none;margin:10px 0 0;padding:0}
.bk li{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--line);font:700 12.5px/17px var(--font-text)}
.bk li b{font-weight:800}
.acts{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.acts .btn{justify-content:center;height:40px}
"""
TRACE = [
    ("k-kid", "19:42:08", "Learner asked Ask Kix", "typed question · P6 Maths · steps"),
    ("k-ai", "19:42:08", "Ask Kix · muse-spark-1.3", "agent v3 · skill P6 Maths v1.3 · 2.4 s · 1,812 → 604 tokens · $0.0048"),
    ("k-guard", "19:42:10", "Guard: enforceStage(steps)", "final answer held back for the full stage"),
    ("k-rep", "19:43:51", "Learner flagged it", "Answer looks wrong · note screened · signature checked"),
    ("k-guard", "19:43:51", "Case built", "nickname → Learner · ids removed"),
    ("k-ai", "19:43:53", "Reproduce × 3 on the same versions", "2 of 3 runs change the total"),
    ("k-ai", "19:44:02", "Review · Muse Spark Open · Baseten", "6.1 s · problem · model behaviour · 94"),
    ("k-ai", "19:44:09", "Re-test with the caution", "3 of 3 keep the total · Ask Kix evals 41/41"),
    ("k-dec", "19:44:10", "Decision: 90 is under 100", "waiting for you"),
]
cs = f"""{NAV()}
<main class="ad-main">
 <p class="ad-sub" style="margin:0">Kix Synapse › Inbox › Report #214</p>
 <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-top:4px"><div><h1 class="ad-h1">Step 3 changes the total</h1><p class="ad-sub">Kix's reply · Ask Kix · P6 Maths · before-and-after · flagged by a P6 learner</p></div>
 <div style="display:flex;gap:6px"><span class="chip c-wait">Waiting for you</span><span class="chip c-def">Becomes an eval case</span></div></div>
 <div class="cg">
  <div class="card" style="overflow:hidden"><span class="h2">Trace</span><p class="ad-sub" style="margin-top:2px">Ids and numbers for every call; words only for the turn the learner reported.</p>
   <ul class="tl">{"".join(f'<li><i class="{k}"></i><em>{t}</em>{a}<small>{b}</small></li>' for k, t, a, b in TRACE)}</ul></div>
  <div class="mid">
   <div class="card"><span class="h2">What the learner saw, and their report</span>
    <div class="saw" style="margin-top:8px"><div class="mini"><b>Steps</b><ol><li>Before: A = 3u, B = 1u, total = 4u</li><li>85 move: A = 3u − 85, B = 1u + 85</li><li class="bad">Total after: 4u − 20 = 180</li></ol></div>
    <div class="rpt"><span class="chip c-flag">{ico(FLAG, 12, sw=2.6)}Answer looks wrong</span><p style="margin-top:6px">"Step 3 changes the total. It should stay the same."</p></div></div></div>
   <div class="card verdict"><div style="display:flex;justify-content:space-between;align-items:center"><span class="h2">Synapse Reviewer</span><span class="chip c-open">Muse Spark Open · Baseten</span></div>
    <p><b>A real problem: how the model worked.</b> When marbles move from Box A to Box B, the total stays 4u. Step 3 takes 20 from the total, which no move explains, so the full answer would come out as 135 instead of 153.</p>
    <div style="margin-top:10px" class="h2">Proposed fix: a learned caution for Ask Kix</div>
    <div class="cau mono"><b>When</b> items move between two groups in a before-and-after problem, <b>check</b> the total stays the same before working out one unit.</div>
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><span class="chip c-def">P6</span><span class="chip c-def">Maths</span><span class="chip c-def">before-and-after</span><span class="chip c-def">expires 28 Nov unless confirmed</span></div></div>
   <div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><span class="h2">Test: final answer = 153</span><span class="mono" style="color:var(--ink-muted)">number · from this case</span></div>
    <div class="tst"><div style="background:#FDE8E8;color:#A21C1C">1 of 3 right<small>now, without the fix</small></div><div style="background:#E6F6EA;color:#1F5E37">3 of 3 right<small>with the caution</small></div><div style="background:#E6F6EA;color:#1F5E37">41 / 41<small>Ask Kix's other evals still pass</small></div></div></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
   <div class="card"><span class="h2">Synapse confidence</span><div style="display:flex;align-items:flex-end;gap:10px;margin-top:6px"><span class="big">90</span><span class="ad-sub" style="margin:0 0 6px">needs 100 to fix by itself</span></div>{meter(90, "#F2A93B", 100, 252)}
    <ul class="bk"><li>Reviewer<b>94</b></li><li>Reproduced<b>2 of 3 runs · cap 90</b></li><li>Code checks<b>4 of 4</b></li><li>Re-test<b>3 of 3</b></li><li>Second opinion<b>not needed: no score change</b></li></ul>
    <div class="acts"><span class="btn b-pri">{ico(CHECK, 16, sw=3)}Approve and add the caution</span><span class="btn b-sec">Edit the caution</span><span class="btn b-del">Not a problem</span></div>
    <div class="h2" style="margin-top:14px">When you approve</div><ul class="bk" style="margin-top:4px"><li>Ask Kix uses it<b>within 60 s</b></li><li>The learner hears<b>Fixed, thanks to you</b></li><li>Ask Kix's evals<b>42 cases, nightly</b></li></ul></div>
   <div class="card"><span class="h2">{ico(LOCK, 14)} Privacy</span><p class="ad-sub">Only the turn the learner reported, nickname replaced. Reviewed on Baseten with zero data retention. Every action is logged.</p></div>
  </div>
 </div>
</main>"""
board("SynapseCase", "Kix Synapse: a case, from flag to fix", 1440, 900, "anime-sky", cs, cs_css)

# 5. Learned cautions and evals (1440x900)
le_css = ad_css + """
.lg{position:absolute;left:28px;right:28px;top:150px;bottom:22px;display:grid;grid-template-columns:240px minmax(0,1fr) 360px;gap:14px}
.al a{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:12px;font:700 14px var(--font-text);color:var(--ink)}
.al a.on{background:var(--surface);box-shadow:inset 0 0 0 2px var(--accent)}
.al small{font:800 11px var(--font-text);color:var(--ink-muted)}
.cl{display:flex;flex-direction:column;gap:10px}
.cv{border-radius:16px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);padding:12px 14px}
.cv p{font:600 14px/20px var(--font-text)}
.cv p b{color:var(--accent);font-weight:800}
.cv .meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center}
.cv .row{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px}
.stack{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.stack div{border-radius:12px;padding:9px 12px;font:800 13px/18px var(--font-text);display:flex;justify-content:space-between;gap:10px}
.stack small{font:700 12px/16px var(--font-text);opacity:.85}
.ev{display:grid;grid-template-columns:110px 1fr 54px;gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--line);font:700 13px/18px var(--font-text)}
.ev:first-of-type{border-top:0}
.ev b{text-align:right;font-weight:800}
.ev svg{width:100%;height:28px}
.fail{margin-top:10px;border-radius:14px;background:#FFF1F1;padding:10px 12px;font:700 12.5px/18px var(--font-text);color:#7A1D1D}
"""
def spark(points, bad=False):
    xs = [i * (180 / (len(points) - 1)) for i in range(len(points))]
    d = " ".join(f"{x:.1f},{28 - (p - 80) * 1.3:.1f}" for x, p in zip(xs, points))
    col = "#E5484D" if bad else "#2E9E5B"
    return f'<svg viewBox="0 0 180 30" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="2" x2="180" y2="2" stroke="var(--line)" stroke-width="1"/><polyline points="{d}" fill="none" stroke="{col}" stroke-width="2" stroke-linejoin="round"/></svg>'
EVALS = [("Ask Kix", [97, 98, 98, 100, 100, 100, 98, 100, 100, 100, 100, 100, 100, 100], "41/41", False), ("Kix Tutor", [100] * 9 + [96, 100, 100, 100, 100], "22/22", False),
         ("Critter Keeper", [89, 89, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], "9/9", False), ("Reason coach", [100] * 14, "18/18", False),
         ("Vibe Zone maker", [100] * 12 + [100, 92], "12/13", True), ("Tonight", [94, 94, 94, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 94], "16/17", True)]
CAUTIONS = [
    ("never write the final number in a hint, even inside a step", "a hint is asked", ["All levels", "Maths"], "From 2 reports · added by Synapse at 100", "Evals 12/12", "expires in 29 days"),
    ("name the evidence from the question before the claim", "a science answer needs a reason", ["P5–P6", "Science", "CER"], "From 3 reports · added by Synapse at 100", "Evals 6/6", "expires in 24 days"),
    ("convert at the end and say so in the last step", "the question gives cm³ and asks for litres", ["P6", "Maths", "volume"], "From 1 report · approved by you", "Evals 4/4", "confirmed"),
]
le = f"""{NAV()}
<main class="ad-main">
 <div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h1 class="ad-h1">Kix Synapse</h1><p class="ad-sub">What the agents have learned. Each caution came from a report, was proven by a test, and only narrows what the agent does.</p></div><span class="btn b-sec">Run all evals now</span></div>
 {SUBNAV("Learned")}
 <div class="lg">
  <div class="card al">{"".join(f'<a class="{"on" if n == "Ask Kix" else ""}">{n}<small>{c}</small></a>' for n, c in [("Ask Kix", "3"), ("Kix Tutor", "2"), ("Critter Keeper", "2"), ("Reason coach", "1"), ("Tonight", "1"), ("Vibe Zone maker", "0"), ("Memory Keeper", "0"), ("Content Curator", "0")])}</div>
  <div class="cl">
   <div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><span class="h2">Ask Kix: 3 learned cautions</span><span class="ad-sub" style="margin:0">12 at most · merged when they overlap</span></div>
    <div class="cl" style="margin-top:10px">{"".join(f'<div class="cv"><p><b>When</b> {w}, <b>check</b>: {c}.</p><div class="meta">{"".join(f"<span class=\"chip c-def\">{t}</span>" for t in tags)}<span class="ad-sub" style="margin:0 0 0 4px">{src}</span></div><div class="row"><span style="display:flex;gap:6px"><span class="chip c-ok">{ev}</span><span class="chip {"c-ok" if exp == "confirmed" else "c-wait"}">{exp}</span></span><span style="display:flex;gap:6px">{"" if exp == "confirmed" else "<span class=\"btn b-sec\">Confirm</span>"}<span class="btn b-sec">Edit</span><span class="btn b-del">Retire</span></span></div></div>' for c, w, tags, src, ev, exp in CAUTIONS)}</div></div>
   <div class="card"><span class="h2">How Ask Kix's prompt is put together</span>
    <div class="stack"><div style="background:#E8E6F7;color:#3B3780"><span>1 · Instructions v3</span><small>editable in Under the hood</small></div><div style="background:#2B2A5C;color:#FFE38A"><span style="display:flex;gap:6px;align-items:center">2 · {ico(SPARK, 13, fill=True)}Learned cautions</span><small style="color:#EDE9FF">only the ones whose tags match the question</small></div><div style="background:#1B2350;color:#fff"><span style="display:flex;gap:6px;align-items:center">3 · {ico(LOCK, 14)}Guardrails, fixed in code</span><small>always last, always win</small></div></div></div>
  </div>
  <div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><span class="h2">Evals, last 14 nights</span><span class="ad-sub" style="margin:0">pass rate</span></div>
   <div style="margin-top:8px">{"".join(f'<div class="ev"><span>{n}</span>{spark(p, bad)}<b style="color:{"#A21C1C" if bad else "inherit"}">{r}</b></div>' for n, p, r, bad in EVALS)}</div>
   <div class="fail"><b>2 failing since last night.</b> Vibe Zone maker: "flashcards keep the pack's spelling". Tonight: "counts sessions, not visits". Both reports reopened.</div>
   <p class="ad-sub" style="font-size:12px;margin-top:10px">Every fixed report becomes a case. Cases run on every published version, before every fix, and nightly at 03:00.</p></div>
 </div>
</main>"""
board("SynapseLearned", "Kix Synapse: learned cautions and evals", 1440, 900, "anime-sky", le, le_css)

# 6. Settings and Retrain (1440x900)
st_css = ad_css + """
.sg3{position:absolute;left:28px;right:28px;top:150px;bottom:22px;display:grid;grid-template-columns:330px minmax(0,1fr) 350px;gap:14px}
.sl{margin-top:12px;position:relative;height:52px}
.sl .tk{position:absolute;left:0;right:0;top:18px;height:8px;border-radius:999px;background:linear-gradient(90deg,var(--line) 0%,var(--line) 100%)}
.sl .fi{position:absolute;left:0;right:0;top:18px;height:8px;border-radius:999px;background:var(--accent)}
.sl .kn{position:absolute;right:-6px;top:10px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px var(--accent),0 4px 10px rgba(0,0,0,.15)}
.sl .lb{position:absolute;top:40px;font:700 11px var(--font-text);color:var(--ink-muted)}
.tg{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid var(--line)}
.tg b{display:block;font:800 14px/19px var(--font-text)}
.tg small{display:block;font:600 12.5px/17px var(--font-text);color:var(--ink-muted)}
.sw{flex:none;width:44px;height:26px;border-radius:999px;background:var(--line);position:relative}
.sw:after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.sw.on{background:var(--accent)}.sw.on:after{left:21px}
.mr{display:grid;grid-template-columns:118px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}
.mr b{font:800 14px/19px var(--font-text)}
.mr small{display:block;font:600 12px/16px var(--font-text);color:var(--ink-muted)}
.pv{display:inline-flex;align-items:center;gap:8px;font:800 14px/18px var(--font-text);white-space:nowrap}
.pv i{width:10px;height:10px;border-radius:50%}
.bud{margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.bud div{border-radius:14px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);padding:10px 12px;font:700 12px/16px var(--font-text);color:var(--ink-muted)}
.bud b{display:block;font:600 22px/26px var(--font-display);color:var(--ink)}
.rt{background:radial-gradient(100% 80% at 90% 0%,#3B3A7A,#1B2350 70%);color:#fff;box-shadow:none}
.rt .ad-sub{color:#C9C3F0}
.ds{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.ds div{border-radius:14px;background:rgba(255,255,255,.08);padding:10px 12px;font:700 12px/16px var(--font-text);color:#D9D3FF}
.ds b{display:block;font:600 26px/30px var(--font-display);color:#FFE38A}
.flow{display:flex;align-items:center;gap:6px;margin-top:14px;flex-wrap:wrap}
.flow span{height:30px;padding:0 10px;border-radius:999px;display:inline-flex;align-items:center;font:800 12px/1 var(--font-text);background:rgba(255,255,255,.1);color:#fff}
.flow span.dim{background:transparent;box-shadow:inset 0 0 0 1.5px rgba(185,167,245,.6);color:#C9C3F0}
.flow em{font-style:normal;color:#FFE38A}
.pr{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 0;border-top:1px solid rgba(185,167,245,.25)}
.pr b{display:block;font:800 14px/19px var(--font-text)}
.pr small{display:block;font:600 12px/16px var(--font-text);color:#C9C3F0}
.ghost{height:32px;padding:0 12px;border-radius:999px;display:inline-flex;align-items:center;font:800 12px var(--font-text);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.5);color:#fff;white-space:nowrap}
"""
MODELS = [("Reviewer", "Reads each report and drafts the fix", "#7C5CFF", "Muse Spark Open", "Baseten · Meta open weights · zero data retention"),
          ("Second opinion", "Any fix that changes a score", "#1F66C1", "Muse Spark 1.3", "Meta Model API · Standard"),
          ("Eval judge", "Checks meaning when code can't", "#7C5CFF", "Muse Spark Open", "Baseten · zero data retention"),
          ("Kid-facing agents", "Kix, Ask Kix, Critter Keeper…", "#1F66C1", "Muse Spark 1.3", "Standard only (rule 1)")]
st = f"""{NAV()}
<main class="ad-main">
 <div><h1 class="ad-h1">Kix Synapse</h1><p class="ad-sub">How much Synapse may do by itself, which model does each job, and what it costs.</p></div>
 {SUBNAV("Settings")}
 <div class="sg3">
  <div class="card"><span class="h2">Fix by itself</span>
   <p class="ad-sub">Synapse fixes a report by itself only when its confidence reaches this line: the problem reproduced, every code check passed and the re-test green.</p>
   <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px"><span class="h2">Threshold</span><span style="font:600 34px/34px var(--font-display)">100</span></div>
   <div class="sl"><div class="tk"></div><div class="fi"></div><div class="kn"></div><span class="lb" style="left:0">50</span><span class="lb" style="left:48%">75</span><span class="lb" style="right:0">100</span></div>
   <div class="tg"><span><b>Scoring changes always need me</b><small>Answer keys and marking rules wait for you, with a second opinion, at any confidence.</small></span><span class="sw on"></span></div>
   <div class="tg"><span><b>Repeated reports may skip the queue at 95</b><small>When two or more learners report the same problem.</small></span><span class="sw"></span></div>
   <div class="tg"><span><b>Fixes by itself a day</b><small>After this many, the rest wait for you.</small></span><span class="btn b-sec">20</span></div>
   <div class="tg"><span><b>Synapse is on</b><small>Off: reports are still kept, nothing is reviewed.</small></span><span class="sw on"></span></div></div>
  <div class="card"><span class="h2">Models for each job</span><p class="ad-sub">Each job can use its own model. If Baseten is down, Muse Spark 1.3 reviews and the case says so.</p>
   {"".join(f'<div class="mr"><span><b>{j}</b><small>{d}</small></span><span><span class="pv"><i style="background:{c}"></i>{m}</span><small>{h}</small></span>{"<span class=\"chip c-def\">" + ico(LOCK, 12) + "Fixed</span>" if j == "Kid-facing agents" else "<span class=\"btn b-sec\">Change</span>"}</div>' for j, d, c, m, h in MODELS)}
   <div class="h2" style="margin-top:12px">Budget</div>
   <div class="bud"><div><b>$2.00</b>reviews a day</div><div><b>$0.50</b>evals a night</div><div><b>$0.31</b>spent today</div></div></div>
  <div class="card rt"><div style="display:flex;justify-content:space-between;align-items:center"><span class="h2">Retrain Kix</span><span class="chip c-open">Next</span></div>
   <p class="ad-sub">Every fix becomes a training example. When a trainer is connected, a myKx model learns from them and must pass the evals before it does any job.</p>
   <div class="ds"><div><b>214</b>fixed replies: question → better answer</div><div><b>61</b>pairs: worse answer vs better</div><div><b>12</b>families turned on Help Kix learn</div><div><b>0</b>names, ids or Guardian data</div></div>
   <div class="flow"><span>Dataset</span><em>→</em><span class="dim">Train</span><em>→</em><span class="dim">Evals gate</span><em>→</em><span class="dim">Use for a job</span></div>
   <div style="margin-top:14px"><div class="pr"><span><b>Baseten Training</b><small>Fine-tune a Meta open-weight model</small></span><span class="ghost">Not connected yet</span></div>
   <div class="pr"><span><b>Your own trainer</b><small>Download the de-identified JSONL</small></span><span class="ghost">Export JSONL</span></div></div>
   <p class="ad-sub" style="font-size:12px;margin-top:8px">Only from families who said yes. Deleted from the next export if they turn it off.</p></div>
 </div>
</main>"""
board("SynapseSettings", "Kix Synapse: settings and retrain", 1440, 900, "anime-sky", st, st_css)
print("written")
