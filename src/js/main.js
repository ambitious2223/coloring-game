// Color Chaos - entry point. Wires config + i18n + engine + UI + hub connector.
import { config, canvasBase } from './config.js';
import { createI18n } from './i18n/index.js';
import { buildPalette } from './core/palette.js';
import { parseChat } from './core/parser.js';
import { createRateLimiter } from './core/rate-limit.js';
import { createEngine } from './core/engine.js';
import { createBoard } from './ui/board.js';
import { createPaletteBar } from './ui/palette-bar.js';
import { createTicker } from './ui/ticker.js';
import { wireHostDock } from './ui/host-dock.js';
import { connectConnector } from './integrations/connector.js';

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

const i18n = createI18n(config.lang);
document.documentElement.lang = i18n.lang;
document.documentElement.dir = i18n.dir;

function setText(id, key) {
  const el = document.getElementById(id);
  if (el) el.textContent = i18n.t(key);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Engine reason codes -> i18n keys.
const REASON_KEY = {
  'unknown-region': 'reasonUnknown',
  'bad-color': 'reasonBadColor',
  locked: 'reasonLocked',
  cooldown: 'reasonCooldown',
  cap: 'reasonCap',
};

async function boot() {
  setText('tTitle', 'title');
  setText('tSubtitle', 'subtitle');
  setText('tProgress', 'progress');
  setText('tPalette', 'palette');
  setText('tFeed', 'feed');
  setText('tHint', 'hint');
  setText('tDock', 'dock');
  setText('tMode', 'mode');
  setText('tRegion', 'region');
  setText('tColor', 'color');
  setText('tUser', 'user');
  document.getElementById('dockSend').textContent = i18n.t('send');
  document.getElementById('dockSimulate').textContent = i18n.t('simulate');
  document.getElementById('dockReset').textContent = i18n.t('reset');
  const modeSel = document.getElementById('dockMode');
  modeSel.options[0].textContent = i18n.t('lock');
  modeSel.options[1].textContent = i18n.t('chaos');

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
  let connector = null;

  const board = createBoard({
    mount: document.getElementById('board'),
    svgText,
    meta,
    palette,
    onRegionClick: (n) => {
      if (engine.has(n)) regionInput.value = String(n);
    },
  });

  const paletteBar = createPaletteBar({
    root: document.getElementById('paletteBar'),
    palette,
    i18n,
    onPick: (c) => {
      document.getElementById('dockColor').value = String(c.index);
      paletteBar.highlight(c.index);
    },
  });

  const ticker = createTicker({ root: document.getElementById('ticker'), i18n });

  const colorSel = document.getElementById('dockColor');
  colorSel.innerHTML = palette
    .map((c) => `<option value="${c.index}">${c.index} - ${i18n.t(c.nameKey)}</option>`)
    .join('');

  const regionInput = document.getElementById('dockRegion');
  regionInput.max = String(engine.total());

  function updateProgress() {
    const p = engine.progress();
    document.getElementById('progressText').textContent = `${p.colored} / ${p.total}`;
    document.getElementById('progressBar').style.width = `${p.total ? (p.colored / p.total) * 100 : 0}%`;
  }

  function reportState() {
    if (connector) {
      connector.reportState({ ready: true, phase: 'playing', canvas: config.canvas, ...engine.snapshot() });
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
    const c = palette[color - 1];
    ticker.add({ user, region: res.region.number, hex: c.hex, verb: i18n.t('verb' + cap(res.verb)) });
    updateProgress();
    reportState();
    return res;
  }

  function handleChat(ev) {
    const user = ev.username || ev.user || ev.nickname || 'viewer';
    const text = ev.message != null ? ev.message : ev.comment != null ? ev.comment : ev.text || '';
    const parsed = parseChat(text, palette, colorIndex);
    if (!parsed) return;
    doColor(parsed.region, parsed.color, user);
  }

  function handleEffect(ef) {
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
    if (connector) connector.ackEffect(ef.id, { ok: true, effect: key });
    reportState();
  }

  const dock = wireHostDock({
    engine,
    onSubmit: (region, color, user) => {
      const res = doColor(region, color, user, { bypassLimit: true });
      if (!res.ok) dock.setStatus(i18n.t(REASON_KEY[res.reason] || 'reasonUnknown'), 'warn');
    },
    onReset: () => {
      engine.clearAll();
      board.reset();
      ticker.clear();
      limiter.reset();
      updateProgress();
      reportState();
    },
    onSimulate: () => {
      const user = 'sim' + (100 + Math.floor(Math.random() * 900));
      const region = 1 + Math.floor(Math.random() * engine.total());
      const color = 1 + Math.floor(Math.random() * palette.length);
      doColor(region, color, user);
    },
    onModeChange: (m) => {
      engine.setMode(m);
      document.getElementById('modeBadge').textContent = i18n.t(m);
      reportState();
    },
  });

  const samples = [];
  for (let i = 0; i < 24; i++) {
    samples.push(`${1 + Math.floor(Math.random() * engine.total())} ${1 + Math.floor(Math.random() * palette.length)}`);
  }

  updateProgress();
  document.getElementById('modeBadge').textContent = i18n.t(engine.mode);

  connector = await connectConnector({
    config,
    capabilities: CAPABILITIES,
    onChat: handleChat,
    onEffect: handleEffect,
    onStatus: (s) => dock.setStatus(i18n.t(s && s.kind === 'mock' ? 'statusMock' : 'statusHub'), s && s.kind === 'mock' ? 'mock' : 'ok'),
    samples,
  });
  dock.setStatus(i18n.t(connector.kind === 'hub' ? 'statusHub' : 'statusMock'), connector.kind === 'hub' ? 'ok' : 'mock');
  reportState();
}

boot();
