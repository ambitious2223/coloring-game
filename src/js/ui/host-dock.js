// Color Chaos - host dock (debug/preview controls).
// Toggled with the ` (backquote) key. Lets you switch modes, inject a color as
// the host, simulate a random viewer, or reset - all without a live stream.
export function wireHostDock({ engine, onSubmit, onReset, onSimulate, onModeChange }) {
  const dock = document.getElementById('dock');
  const modeSel = document.getElementById('dockMode');
  const regionEl = document.getElementById('dockRegion');
  const colorEl = document.getElementById('dockColor');
  const userEl = document.getElementById('dockUser');

  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (e.code === 'Backquote' && !/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) {
      e.preventDefault();
      dock.classList.toggle('open');
    }
  });

  modeSel.value = engine.mode;
  modeSel.addEventListener('change', () => onModeChange(modeSel.value));

  document.getElementById('dockSend').addEventListener('click', () => {
    onSubmit(Number(regionEl.value), Number(colorEl.value), userEl.value || 'host');
  });
  document.getElementById('dockSimulate').addEventListener('click', () => onSimulate());
  document.getElementById('dockReset').addEventListener('click', () => onReset());

  return {
    setStatus(text, cls) {
      const el = document.getElementById('dockStatus');
      if (el) {
        el.textContent = text;
        el.className = 'cc-status ' + (cls || '');
      }
    },
    setMode(mode) {
      modeSel.value = mode;
    },
  };
}
