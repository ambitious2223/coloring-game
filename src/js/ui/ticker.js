// Color Chaos - live coloring feed (contributor ticker).
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createTicker({ root, i18n }) {
  let items = [];

  function render() {
    root.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'cc-feed-empty';
      empty.textContent = i18n.t('feedEmpty');
      root.appendChild(empty);
      return;
    }
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'cc-feed-item';
      row.innerHTML =
        `<span class="cc-feed-chip" style="background:${it.hex}"></span>` +
        `<b>${escapeHtml(it.user)}</b>` +
        `<span class="cc-feed-region">#${it.region}</span>` +
        `<span class="cc-feed-verb">${escapeHtml(it.verb)}</span>`;
      root.appendChild(row);
    }
  }

  render();
  return {
    add(entry) {
      items.unshift(entry);
      if (items.length > 40) items.pop();
      render();
    },
    clear() {
      items = [];
      render();
    },
  };
}
