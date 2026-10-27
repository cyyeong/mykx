  // ---- Living background (shared by the arcade boards) ----
  // heat 0–3 brightens the scene as the child plays well; pulse 'a'/'b' flips on every hit so the bloom replays.
  // Each hidden tap spot plays its next reaction in turn, so taps feel different each time (no randomness).
  amModel(heat, pulse) {
    const SPOTS = { rig: ['swap', 'strobe', 'fan', 'search'], fogl: ['puff', 'ring', 'burst'], fogr: ['ring', 'burst', 'puff'], sky: ['frog', 'shower', 'rocket', 'crown'], planet: ['moon', 'ring', 'glint'], pond: ['ripple', 'bubbles', 'double', 'plip'], fern: ['spores', 'dew', 'fireflies'] };
    const am = this.state.am || { spot: '', act: '', n: {} };
    const vals = { amHeat: String(heat), amPulse: pulse || '', amShow: am.spot ? `${am.spot}-${am.act}` : '' };
    for (const [id, acts] of Object.entries(SPOTS)) {
      const key = id.charAt(0).toUpperCase() + id.slice(1);
      vals[`amAct${key}`] = am.spot === id ? am.act : '';
      vals[`am${key}`] = () => {
        const cur = this.state.am || { n: {} };
        const n = cur.n[id] || 0;
        this.setState({ am: { spot: id, act: acts[n % acts.length], n: { ...cur.n, [id]: n + 1 } } });
      };
    }
    return vals;
  }
