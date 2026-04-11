/** Standalone /launcher page (also used inside modal iframe). Uses `/api/launcher/*`. */
export function getLauncherPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CursorRemote — Sessions</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #181818; color: #e4e4e4; margin: 0; padding: 24px; }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    .sub { color: #888; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #333; vertical-align: top; }
    th { color: #aaa; font-weight: 600; }
    .active { color: #6ee7b7; }
    .inactive { color: #9ca3af; }
    .invalid { color: #f87171; }
    button {
      background: #3794ff; color: #fff; border: none; padding: 6px 12px; border-radius: 6px;
      cursor: pointer; font-size: 13px; margin: 2px 4px 2px 0;
    }
    button.secondary { background: #3c3c3c; }
    button.danger { background: #b91c1c; }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    .row-actions { white-space: normal; max-width: 420px; }
    .toolbar { margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    input[type="text"] {
      background: #232323; border: 1px solid #444; color: #e4e4e4; padding: 8px 10px;
      border-radius: 6px; min-width: 220px;
    }
    code { font-size: 12px; background: #2a2a2a; padding: 2px 6px; border-radius: 4px; }
    .msg { margin-top: 12px; padding: 10px; border-radius: 8px; background: #2a2a2a; display: none; }
    .msg.show { display: block; }
    .msg.err { background: #3f1f1f; color: #fecaca; }
  </style>
</head>
<body>
  <h1>CursorRemote sessions</h1>
  <p class="sub">New session creates <code>data/&lt;name&gt;/</code>, frees any old Cursor on that session, picks a CDP port, launches Cursor, then opens relay UI at <code>/s/&lt;name&gt;/</code>. Start relay does the same for an existing session.</p>
  <div class="toolbar">
    <input type="text" id="customName" placeholder="Optional name (e.g. calm-ocean)" />
    <button type="button" id="btnNew">New session (spawn Cursor)</button>
    <button type="button" class="secondary" id="btnRefresh">Refresh</button>
  </div>
  <div id="msg" class="msg"></div>
  <table>
    <thead><tr>
      <th>Session</th><th>CDP</th><th>Relay</th><th>Status</th><th>Actions</th>
    </tr></thead>
    <tbody id="rows"></tbody>
  </table>
  <script>
    const API = '/api/launcher';
    const msgEl = document.getElementById('msg');
    function showMsg(text, isErr) {
      msgEl.textContent = text;
      msgEl.className = 'msg show' + (isErr ? ' err' : '');
    }
    async function load() {
      const r = await fetch(API + '/sessions', { credentials: 'same-origin' });
      const data = await r.json();
      if (!r.ok) { showMsg(data.error || 'Failed to load', true); return; }
      const tb = document.getElementById('rows');
      tb.innerHTML = '';
      for (const s of data.sessions) {
        const tr = document.createElement('tr');
        const stClass = s.health === 'active' ? 'active' : s.health === 'inactive' ? 'inactive' : 'invalid';
        const relay =
          s.relayRunning && s.lock.relayEmbedded
            ? '<a href="/s/' + escapeHtml(s.name) + '/" style="color:#93c5fd">/s/' + escapeHtml(s.name) + '/</a>'
            : s.relayRunning && s.lock.relayPort
              ? '<span style="color:#888">legacy :' + s.lock.relayPort + '</span>'
              : '—';
        tr.innerHTML =
          '<td><strong>' + escapeHtml(s.name) + '</strong><br/><small style="color:#777">' + escapeHtml(s.healthDetail) + '</small></td>' +
          '<td><code>' + s.lock.cdpPort + '</code></td>' +
          '<td>' + relay + '</td>' +
          '<td class="' + stClass + '">' + s.health + '</td>' +
          '<td class="row-actions">' + actionsHtml(s) + '</td>';
        tb.appendChild(tr);
      }
      for (const b of tb.querySelectorAll('button[data-action]')) {
        b.addEventListener('click', () => onAction(b.dataset.action, b.dataset.name));
      }
    }
    function escapeHtml(t) {
      const d = document.createElement('div');
      d.textContent = t;
      return d.innerHTML;
    }
    function actionsHtml(s) {
      const n = JSON.stringify(s.name);
      let h = '';
      if (s.health === 'inactive') {
        h += '<button data-action="start-relay" data-name=' + n + '>Start relay</button>';
        h += '<button class="secondary" data-action="cleanup" data-name=' + n + '>Remove stale lock</button>';
      }
      if (s.health === 'active' && !s.relayRunning) {
        h += '<button data-action="start-relay" data-name=' + n + '>Start relay</button>';
      }
      if (s.relayRunning) {
        h += '<button class="secondary" data-action="stop-relay" data-name=' + n + '>Stop relay</button>';
      }
      if (s.lock.cursorPid) {
        h += '<button class="danger" data-action="stop-cursor" data-name=' + n + '>Kill Cursor (PID)</button>';
      }
      return h || '<span style="color:#666">—</span>';
    }
    async function onAction(action, name) {
      showMsg('');
      let url = '', opt = { method: 'POST', credentials: 'same-origin' };
      if (action === 'start-relay') url = API + '/sessions/' + encodeURIComponent(name) + '/start-relay';
      if (action === 'stop-relay') url = API + '/sessions/' + encodeURIComponent(name) + '/stop-relay';
      if (action === 'stop-cursor') url = API + '/sessions/' + encodeURIComponent(name) + '/stop-cursor';
      if (action === 'cleanup') url = API + '/sessions/' + encodeURIComponent(name) + '/cleanup-lock';
      const r = await fetch(url, opt);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) showMsg(data.error || r.statusText, true);
      else if (data.path || data.url) {
        const dest = data.path || (typeof data.url === 'string' ? data.url.replace(/^https?:\\/\\/[^/]+/, '') : '');
        if (dest) {
          try {
            if (window.top && window.top !== window) {
              window.top.location.assign(dest.startsWith('/') ? dest : '/' + dest);
            } else {
              window.location.assign(dest.startsWith('/') ? dest : '/' + dest);
            }
          } catch {
            showMsg('Relay: ' + (data.url || dest));
          }
        } else if (data.url) showMsg('Relay: ' + data.url);
      }
      await load();
    }
    document.getElementById('btnRefresh').addEventListener('click', () => load());
    document.getElementById('btnNew').addEventListener('click', async () => {
      const custom = document.getElementById('customName').value.trim();
      showMsg('');
      const r = await fetch(API + '/sessions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: custom || undefined }),
      });
      const data = await r.json();
      if (!r.ok) showMsg(data.error || 'Failed', true);
      else if (data.path) {
        try {
          window.location.assign(data.path.startsWith('/') ? data.path : '/' + data.path);
        } catch {
          showMsg('Session ' + data.name + ' · CDP ' + data.cdpPort + ' — ' + (data.url || ''));
        }
      } else {
        showMsg('Created ' + data.name + ' · CDP port ' + data.cdpPort);
      }
      document.getElementById('customName').value = '';
      await load();
    });
    load();
  </script>
</body>
</html>`;
}
