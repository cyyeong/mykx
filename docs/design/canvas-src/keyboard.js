  // ---- Ghost-hands keyboard (shared by the three typing looks) ----
  // Fingers are numbered 1–10 left to right, as a child counts them with both hands flat: left pinky 1 … left
  // pointer 4, thumbs 5 and 6, right pointer 7 … right pinky 10. Keys show their finger's number softly.
  kbModel(nextKey, wrongKey, handsMode) {
    const ROWS = ['qwertyuiop', 'asdfghjkl;', 'zxcvbnm,./'];
    const OFF = [0, 0.25, 0.75];
    const FINGER = { q: 'lp', a: 'lp', z: 'lp', w: 'lr', s: 'lr', x: 'lr', e: 'lm', d: 'lm', c: 'lm', r: 'li', f: 'li', v: 'li', t: 'li', g: 'li', b: 'li', y: 'ri', h: 'ri', n: 'ri', u: 'ri', j: 'ri', m: 'ri', i: 'rm', k: 'rm', ',': 'rm', o: 'rr', l: 'rr', '.': 'rr', p: 'rp', ';': 'rp', '/': 'rp', ' ': 'th' };
    const HOME = { lp: 'a', lr: 's', lm: 'd', li: 'f', ri: 'j', rm: 'k', rr: 'l', rp: ';' };
    const NUM = { lp: 1, lr: 2, lm: 3, li: 4, ri: 7, rm: 8, rr: 9, rp: 10 };
    const NAME = { lp: 'Left pinky', lr: 'Left ring', lm: 'Left middle', li: 'Left pointer', ri: 'Right pointer', rm: 'Right middle', rr: 'Right ring', rp: 'Right pinky', th: 'Thumb' };
    const TINT = { lp: '255, 159, 196', rp: '255, 159, 196', lr: '255, 201, 138', rr: '255, 201, 138', lm: '168, 240, 212', rm: '168, 240, 212', li: '185, 167, 245', ri: '185, 167, 245', th: '255, 227, 138' };
    const SPLAY = { lp: -9, lr: -4, lm: 0, li: 4, ri: -4, rm: 0, rr: 4, rp: 9 };
    const LEN = { lp: 2, lr: 2.3, lm: 2.45, li: 2.35, ri: 2.35, rm: 2.45, rr: 2.3, rp: 2 };
    const at = (k) => {
      if (k === ' ') return { x: 5.75, y: 3.5 };
      for (let r = 0; r < 3; r++) { const c = ROWS[r].indexOf(k); if (c > -1) return { x: OFF[r] + c + 0.5, y: r + 0.5 }; }
      return null;
    };
    const u = (n) => `calc(var(--u) * ${n.toFixed(3)})`;
    const next = nextKey ? nextKey.toLowerCase() : '';
    const active = FINGER[next] || null;
    const keys = [];
    ROWS.forEach((row, r) => row.split('').forEach((k, c) => {
      const f = FINGER[k];
      const cls = 'kb-key' + (k === next ? ' kb-key--next' : '') + (k === wrongKey ? ' kb-key--wrong' : '') + (k === 'f' || k === 'j' ? ' kb-key--bump' : '');
      keys.push({ k, label: k === ';' ? ';' : k.toUpperCase(), n: NUM[f], aria: `${k === ';' ? 'semicolon' : k.toUpperCase()}, finger ${NUM[f]}`, cls, style: `left: ${u(OFF[r] + c + 0.05)}; top: ${u(r + 0.05)}; --f: ${TINT[f]}`, press: () => this.typeKey(k) });
    }));
    keys.push({ k: ' ', label: 'space', n: '', aria: 'space, thumb 5 or 6', cls: 'kb-key kb-key--space' + (next === ' ' ? ' kb-key--next' : ''), style: `left: ${u(3)}; top: ${u(3.05)}; width: ${u(5.5)}; --f: ${TINT.th}`, press: () => this.typeKey(' ') });
    const fingers = Object.keys(HOME).map((f) => {
      const h = at(HOME[f]);
      const t = active === f ? at(next) : h;
      const dx = t.x - h.x, dy = t.y - h.y;
      return {
        n: NUM[f],
        cls: 'kb-finger' + (active === f ? ' kb-finger--on' : ''),
        style: `left: ${u(h.x - 0.32)}; top: ${u(h.y + 0.1)}; --len: ${u(LEN[f])}; --rot: ${SPLAY[f]}deg; transform: translate(${u(dx)}, ${u(dy)}) rotate(${SPLAY[f]}deg); --f: ${TINT[f]}`,
      };
    });
    const thumbOn = active === 'th' ? ' kb-finger--on' : '';
    const thumbs = [
      { n: 5, cls: 'kb-thumb' + thumbOn, style: `left: ${u(3.65)}; top: ${u(3.1)}; --rot: 24deg; transform: rotate(24deg); --f: ${TINT.th}` },
      { n: 6, cls: 'kb-thumb' + thumbOn, style: `left: ${u(7.15)}; top: ${u(3.1)}; --rot: -24deg; transform: rotate(-24deg); --f: ${TINT.th}` },
    ];
    return {
      kbKeys: keys,
      kbFingers: fingers.concat(thumbs),
      kbHands: handsMode,
      kbHint: active ? `${NAME[active]} → ${next === ' ' ? 'space' : next.toUpperCase()}` : '',
      kbHintNums: !active ? [] : (active === 'th' ? [5, 6] : [NUM[active]]).map((n) => ({ n, style: `--f: ${TINT[active]}` })),
    };
  }
