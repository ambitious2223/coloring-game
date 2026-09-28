// Color Chaos - entry point. Wires config + i18n + engine + UI + input source.
import { config, canvasBase } from './config.js';
import { createI18n } from './i18n/index.js';
import { buildPalette } from './core/palette.js';
import { parseChat } from './core/parser.js';
import { createRateLimiter } from './core/rate-limit.js';
import { createEngine } from './core/engine.js';
import { createBoard } from './ui/board.js';
import { createPaletteBar } from './ui/palette-bar.js';
import { createTicker } from './ui/ticker.js';
import { wireControlPanel } from './ui/control-panel.js';
import { createSourceManager } from './integrations/connector.js';

// Effects this game understands - keep in sync with tikora.manifest.json.
const CAPABILITIES = {
  effects: [
    { key: 'premium_color', label: 'Premium color' },
    { key: 'multi_fill', label: 'Multi-fill' },
    { key: 'clear_region', label: 'Clear one region' },
    { key: 'wipe_canvas', label: 'Wipe the whole canvas' },
    { key: 'overwrite', label: 'Recolor a locked region' },
    { key: 'lock_region', label: 'Protect a region' },
    { key: 'rename_region', label: 'Name a region' },
    { key: 'rainbow_sweep', label: 'Rainbow sweep' },
  ],
};

const REASON_KEY = {
  'unknown-region': 'reasonUnknown',
  'bad-color': 'reasonBadColor',
  locked: 'reasonLocked',
  cooldown: 'reasonCooldown',
  cap: 'reasonCap',
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const i18n = createI18n(config.lang);
document.documentElement.lang = i18n.lang;
document.documentElement.dir = i18n.dir;

function setText(id, key) {
  const el = document.getElementById(id);
  if (el) el.textContent = i18n.t(key);
}

async function boot() {
  // --- static text ---
  setText('tTitle', 'title');
  setText('tSubtitle', 'subtitle');
  setText('tProgress', 'progress');
  setText('tPalette', 'palette');
  setText('tHint', 'hint');
  setText('tControls', 'controls');
  setText('tSource', 'source');
  setText('tAutoSim', 'autoSim');
  setText('tMode', 'mode');
  setText('tRegion', 'region');
  setText('tColor', 'color');
  setText('tUser', 'user');
  setText('testBanner', 'testMode');
  document.getElementById('btnControls').textContent = i18n.t('controls');
  document.getElementById('ctlSimulate').textContent = i18n.t('simulateViewer');
  document.getElementById('ctlReset').textContent = i18n.t('resetCanvas');
  document.getElementById('ctlSend').textContent = i18n.t('send');
  setText('liveHintText', 'exitLive');

  const srcSel = document.getElementById('ctlSource');
  srcSel.options[0].textContent = i18n.t('sourceHub');
  srcSel.options[1].textContent = i18n.t('sourceDemo');
  srcSel.options[2].textContent = i18n.t('sourceOff');
  const modeSel = document.getElementById('ctlMode');
  modeSel.options[0].textContent = i18n.t('lock');
  modeSel.options[1].textContent = i18n.t('chaos');

  // --- canvas ---
  let meta;
  let svgText;
  try {
    const [metaRes, svgRes] = await Promise.all([
      fetch(canvasBase + 'canvas.json'),
      fetch(canvasBase + 'canvas.svg'),
    ]);
    if (!metaRes.ok || !svgRes.ok) throw new Error('canvas not found');
    meta = await metaRes.json();
    svgText = await svgRes.text();
  } catch (e) {
    document.getElementById('board').innerHTML =
      `<div class="cc-error">Could not load canvas "${config.canvas}".<br>${e.message}</div>`;
    return;
  }

  const palette = buildPalette(meta.palette);
  const colorIndex = i18n.colorIndex(palette);
  const engine = createEngine({
    regionNumbers: meta.regions.map((r) => r.number),
    paletteSize: palette.length,
    mode: 'lock',
  });
  const limiter = createRateLimiter({ cooldownMs: 4000, shareCap: 0 });

  let selectedColor = 1;
  let lastEventAt = 0;
  let live = false;
  let sourceManager = null;

  const board = createBoard({
    mount: document.getElementById('board'),
    svgText,
    meta,
    palette,
    onRegionClick: (n) => handleRegionClick(n),
  });

  const paletteBar = createPaletteBar({
    root: document.getElementById('paletteBar'),
    palette,
    i18n,
    onPick: (c) => {
      selectedColor = c.index;
      paletteBar.highlight(c.index);
      document.getElementById('ctlColor').value = String(c.index);
    },
  });

  const ticker = createTicker({ root: document.getElementById('ticker'), i18n });

  const colorSel = document.getElementById('ctlColor');
  colorSel.innerHTML = palette
    .map((c) => `<option value="${c.index}">${c.index} - ${i18n.t(c.nameKey)}</option>`)
    .join('');
  // A color is pre-selected so clicking a region colors it immediately.
  if (colorSel.options.length) {
    colorSel.value = String(selectedColor);
    paletteBar.highlight(selectedColor);
  }

  const regionEl = document.getElementById('ctlRegion');
  regionEl.max = String(engine.total());

  function updateProgress() {
    const p = engine.progress();
    document.getElementById('progressText').textContent = `${p.colored} / ${p.total}`;
    document.getElementById('progressBar').style.width = `${p.total ? (p.colored / p.total) * 100 : 0}%`;
  }

  function reportState() {
    if (sourceManager) {
      sourceManager.reportState({ ready: true, phase: live ? 'live' : 'setup', canvas: config.canvas, ...engine.snapshot() });
    }
  }

  function doColor(region, color, user, { bypassLimit = false, override = false } = {}) {
    if (!bypassLimit) {
      const gate = limiter.check(user);
      if (!gate.ok) return { ok: false, reason: gate.reason };
    }
    const res = engine.apply({ regionNumber: region, color, user, override });
    if (!res.ok) return res;
    if (!bypassLimit) limiter.record(user);

    board.setColor(res.region.number, color);
    board.flash(res.region.number);
    ticker.add({ user, region: res.region.number, hex: palette[color - 1].hex, verb: i18n.t('verb' + cap(res.verb)) });
    updateProgress();
    reportState();
    return res;
  }

  // Clicking the board: if a color is picked, color the region (host test);
  // otherwise just select it and load it into the manual send form.
  function handleRegionClick(n) {
    if (selectedColor != null) {
      doColor(n, selectedColor, 'host', { bypassLimit: true });
    } else {
      board.select(n);
      regionEl.value = String(n);
    }
  }

  function handleChat(ev) {
    lastEventAt = Date.now();
    const user = ev.username || ev.user || ev.nickname || 'viewer';
    const text = ev.message != null ? ev.message : ev.comment != null ? ev.comment : ev.text || '';
    const parsed = parseChat(text, palette, colorIndex);
    if (!parsed) return;
    doColor(parsed.region, parsed.color, user);
  }

  function handleEffect(ef) {
    lastEventAt = Date.now();
    const key = ef.effect;
    const payload = ef.payload || {};
    const count = Math.max(1, Number(payload.count) || 1);
    const rnd = (n) => Math.floor(Math.random() * n);

    if (key === 'wipe_canvas') {
      engine.clearAll();
      board.reset();
      ticker.clear();
    } else if (key === 'clear_region') {
      const r = engine.randomColored();
      if (r) {
        engine.clear(r.number);
        board.setRawFill(r.number, '#ffffff');
        board.flash(r.number);
      }
    } else if (key === 'multi_fill' || key === 'rainbow_sweep') {
      for (let i = 0; i < count; i++) {
        const r = engine.randomUncolored();
        if (!r) break;
        const color = 1 + rnd(palette.length);
        engine.apply({ regionNumber: r.number, color, user: 'gift' });
        board.setColor(r.number, color);
      }
    } else if (key === 'overwrite') {
      for (let i = 0; i < count; i++) {
        const r = engine.randomColored() || engine.randomUncolored();
        if (!r) break;
        const color = 1 + rnd(palette.length);
        engine.apply({ regionNumber: r.number, color, user: 'gift', override: true });
        board.setColor(r.number, color);
        board.flash(r.number);
      }
    } else if (key === 'premium_color') {
      const r = engine.randomUncolored();
      if (r) {
        engine.apply({ regionNumber: r.number, color: 1, user: 'gift' });
        board.setRawFill(r.number, '#ffd700');
        board.flash(r.number);
      }
    } else if (key === 'lock_region') {
      const r = engine.randomColored() || engine.randomUncolored();
      if (r) r.locked = true;
    } else if (key === 'rename_region') {
      const r = engine.randomColored();
      if (r) r.name = payload.name || 'VIP';
    }

    updateProgress();
    if (sourceManager) sourceManager.ackEffect(ef.id, { ok: true, effect: key });
    reportState();
  }

  const controlPanel = wireControlPanel({
    i18n,
    onSource: (m) => sourceManager.setMode(m),
    onMode: (m) => {
      engine.setMode(m);
      document.getElementById('modeBadge').textContent = i18n.t(m);
      reportState();
    },
    onSimulate: () => sourceManager.simulateNow(),
    onAutoSim: (v) => sourceManager.setAutoSim(v),
    onReset: () => {
      engine.clearAll();
      board.reset();
      ticker.clear();
      limiter.reset();
      updateProgress();
      reportState();
    },
    onManualSend: (region, color, user) => {
      const res = doColor(region, color, user, { bypassLimit: true });
      if (!res.ok) controlPanel.setStatus(i18n.t(REASON_KEY[res.reason] || 'reasonUnknown'), 'warn');
    },
    onToggleLive: () => setLive(!live),
  });

  function updateStatus() {
    const active = sourceManager ? sourceManager.active : 'off';
    let text = i18n.t('statusOff');
    let cls = '';
    if (active === 'hub') {
      const waiting = Date.now() - lastEventAt > 6000;
      text = i18n.t(waiting ? 'statusHubWaiting' : 'statusHubLive');
      cls = waiting ? 'ok' : 'ok';
    } else if (active === 'demo') {
      text = i18n.t('statusDemo');
      cls = 'mock';
    }
    controlPanel.setStatus(text, cls);
    document.body.classList.toggle('test', active !== 'hub');
    if (srcSel.value !== active && (active === 'hub' || active === 'demo' || active === 'off')) {
      srcSel.value = active;
    }
  }

  let liveHintTimer = null;
  function showLiveHint(ms) {
    const el = document.getElementById('liveHint');
    if (!el) return;
    el.classList.add('show');
    if (liveHintTimer) clearTimeout(liveHintTimer);
    liveHintTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function setLive(next) {
    live = !!next;
    document.body.classList.toggle('live', live);
    controlPanel.setLive(live);
    try {
      localStorage.setItem('cc.live', live ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (live) {
      controlPanel.setOpen(false);
      // A hidden field could still hold focus and swallow the hotkeys.
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      showLiveHint(6000);
    } else {
      const el = document.getElementById('liveHint');
      if (el) el.classList.remove('show');
    }
    reportState();
    updateStatus();
  }

  // hotkeys: H toggles Live, ` toggles controls, Escape exits Live / closes controls
  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(tag);

    if (e.key === 'Escape') {
      if (live) setLive(false);
      else controlPanel.setOpen(false);
      return;
    }
    // In Live mode hotkeys must always work (fields are hidden but may hold focus).
    if (typing && !live) return;
    if (e.key === 'h' || e.key === 'H') {
      setLive(!live);
    } else if (e.code === 'Backquote') {
      e.preventDefault();
      controlPanel.setOpen(!controlPanel.isOpen());
    }
  });

  document.getElementById('liveHint').addEventListener('click', () => setLive(false));
  document.addEventListener('mousemove', () => {
    if (live) showLiveHint(2500);
  });

  // --- build the simulator samples ---
  const samples = [];
  for (let i = 0; i < 24; i++) {
    samples.push(`${1 + Math.floor(Math.random() * engine.total())} ${1 + Math.floor(Math.random() * palette.length)}`);
  }

  // --- start source ---
  sourceManager = createSourceManager({
    config,
    capabilities: CAPABILITIES,
    handlers: { onChat: handleChat, onEffect: handleEffect, onStatus: () => {} },
    samples,
    intervalMs: 2200,
  });
  await sourceManager.setMode(config.source === 'hub' || config.source === 'demo' || config.source === 'off' ? config.source : 'auto');

  // auto-simulate defaults ON (it only runs when not connected to the hub)
  let autoSim = true;
  try {
    const saved = localStorage.getItem('cc.autoSim');
    if (saved === '0') autoSim = false;
    else if (saved === '1') autoSim = true;
  } catch {
    /* ignore */
  }
  autoSim = autoSim; // keep
  sourceManager.setAutoSim(autoSim);
  controlPanel.setAutoSim(autoSim);

  controlPanel.setMode(engine.mode);
  document.getElementById('modeBadge').textContent = i18n.t(engine.mode);
  controlPanel.setSource(sourceManager.active);

  // controls panel open by default on first run (discoverability)
  let openControls = true;
  try {
    const saved = localStorage.getItem('cc.controlsOpen');
    if (saved === '0') openControls = false;
    else if (saved === '1') openControls = true;
  } catch {
    /* ignore */
  }
  controlPanel.setOpen(openControls);

  // live mode
  let startLive = config.live;
  try {
    if (!startLive && localStorage.getItem('cc.live') === '1') startLive = true;
  } catch {
    /* ignore */
  }
  setLive(startLive);

  updateProgress();
  updateStatus();
  reportState();
  setInterval(updateStatus, 1500);

  // persist auto-sim choice
  document.getElementById('ctlAutoSim').addEventListener('change', (e) => {
    try {
      localStorage.setItem('cc.autoSim', e.target.checked ? '1' : '0');
    } catch {
      /* ignore */
    }
  });
}

boot();
