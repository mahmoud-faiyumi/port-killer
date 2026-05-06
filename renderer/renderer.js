(function () {
  'use strict';

  const rowsBody = document.getElementById('rows-body');
  const refreshBtn = document.querySelector('#refresh-btn');
  const freeProtectedBtn = document.querySelector('#free-protected-btn');
  const checkUpdatesBtn = document.querySelector('#check-updates-btn');
  const filterInput = document.querySelector('#filter-input');
  const showSystemPortsInput = document.querySelector('#show-system-ports');
  const devManualPortsOnlyInput = document.querySelector('#dev-manual-ports-only');
  const extraDevPortsInput = document.querySelector('#extra-dev-ports');
  const protectedPortsBtn = document.querySelector('#protected-ports-btn');
  const protectedPortsModal = document.getElementById('protected-ports-modal');
  const protectedPortsModalInput = document.getElementById('protected-ports-modal-input');
  const protectedPortsAddBtn = document.getElementById('protected-ports-add-btn');
  const favoritePortsList = document.getElementById('favorite-ports-list');
  const protectedPortsModalFeedback = document.getElementById('protected-ports-modal-feedback');
  const protectedPortsCancelBtn = document.getElementById('protected-ports-cancel-btn');
  const protectedPortsSaveBtn = document.getElementById('protected-ports-save-btn');
  const killTreeInput = document.querySelector('#kill-tree-input');
  const killDelayInput = document.querySelector('#kill-delay-input');
  const minimizeToTrayInput = document.querySelector('#minimize-to-tray-input');
  const historyRefreshBtn = document.querySelector('#history-refresh-btn');
  const historyList = document.getElementById('history-list');
  const killQueue = document.getElementById('kill-queue');
  const countBadge = document.getElementById('count-badge');
  const snackPanel = document.getElementById('snack-panel');
  const snackText = document.getElementById('snack-text');
  const snackProgress = document.getElementById('snack-progress');
  const installUpdateBtn = document.getElementById('install-update-btn');
  const loading = document.getElementById('loading');
  const emptyHint = document.getElementById('empty-hint');
  const portsTable = document.getElementById('ports-table');
  const releaseNotesModal = document.getElementById('release-notes-modal');
  const releaseNotesTitle = document.getElementById('release-notes-title');
  const releaseNotesVersionLine = document.getElementById('release-notes-version-line');
  const releaseNotesBody = document.getElementById('release-notes-body');
  const releaseNotesOkBtn = document.getElementById('release-notes-ok-btn');

  const WELL_KNOWN_PORT_MAX = 1023;
  const EXTRA_DEV_PORTS_STORAGE_KEY = 'portKiller.devPortsExtra';
  const SNACK_AUTO_HIDE_MS = 5000;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /** @type {number | null} */
  let snackHideTimerId = null;

  /** Keeps renderUpdateState / snack persistence in sync before wider state block runs. */
  let latestUpdateState = null;

  function clearSnackHideTimer() {
    if (snackHideTimerId != null) {
      window.clearTimeout(snackHideTimerId);
      snackHideTimerId = null;
    }
  }

  /** Progress visible, install CTA, or updater still running without auto-dismiss. */
  function snackIsPersistent() {
    if (!snackProgress || !installUpdateBtn) {
      return false;
    }
    if (!snackProgress.hidden) {
      return true;
    }
    if (!installUpdateBtn.hidden) {
      return true;
    }
    const st = latestUpdateState != null ? String(latestUpdateState.status || '') : '';
    return st === 'checking' || st === 'available' || st === 'retrying' || st === 'downloading';
  }

  function scheduleSnackAutoHide() {
    clearSnackHideTimer();
    if (!snackPanel || snackPanel.hidden || snackIsPersistent()) {
      return;
    }
    snackHideTimerId = window.setTimeout(() => {
      snackHideTimerId = null;
      if (!snackIsPersistent() && snackPanel) {
        snackPanel.hidden = true;
        clearSnackPanelTone();
      }
    }, SNACK_AUTO_HIDE_MS);
  }

  function clearSnackPanelTone() {
    if (!snackPanel) {
      return;
    }
    snackPanel.classList.remove('snack-panel--error', 'snack-panel--success');
  }

  function applySnackTone(kind) {
    if (!snackPanel) {
      return;
    }
    clearSnackPanelTone();
    if (kind === 'error') {
      snackPanel.classList.add('snack-panel--error');
    } else if (kind === 'success') {
      snackPanel.classList.add('snack-panel--success');
    }
  }

  function svgIcon(attrs, children) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('icon-svg');
    const extra = attrs.className;
    if (typeof extra === 'string' && extra.trim()) {
      for (const c of extra.trim().split(/\s+/)) {
        svg.classList.add(c);
      }
    }
    svg.setAttribute('width', attrs.width ?? '16');
    svg.setAttribute('height', attrs.height ?? '16');
    svg.setAttribute('viewBox', attrs.viewBox ?? '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const child of children) {
      const el = document.createElementNS(SVG_NS, child.tag);
      for (const [k, v] of Object.entries(child)) {
        if (k === 'tag') {
          continue;
        }
        el.setAttribute(k, v);
      }
      svg.appendChild(el);
    }
    return svg;
  }

  /** Lucide-style pushpin; active state via `.btn-pin-toggle--active` (color + stroke). */
  function iconPin() {
    const stroke = {
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.75',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    };
    return svgIcon(
      { width: '18', height: '18', className: 'icon-svg icon-svg--pin' },
      [
        {
          tag: 'path',
          ...stroke,
          d: 'M12 17v5',
        },
        {
          tag: 'path',
          ...stroke,
          d: 'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 1 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 1-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1v0a1 1 0 0 0-1 1v3.76',
        },
        {
          tag: 'circle',
          ...stroke,
          cx: '12',
          cy: '7',
          r: '4',
        },
      ],
    );
  }

  function iconStar(filled) {
    if (filled) {
      return svgIcon(
        { width: '16', height: '16' },
        [
          {
            tag: 'path',
            fill: 'currentColor',
            'fill-rule': 'evenodd',
            d: 'M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z',
            'clip-rule': 'evenodd',
          },
        ],
      );
    }
    return svgIcon(
      { width: '16', height: '16' },
      [
        {
          tag: 'path',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          d: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
        },
      ],
    );
  }

  function iconClipboard() {
    return svgIcon(
      { width: '14', height: '14' },
      [
        {
          tag: 'path',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
        },
      ],
    );
  }

  function iconHashSmall() {
    return svgIcon(
      { width: '13', height: '13' },
      [
        {
          tag: 'path',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '2',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          d: 'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
        },
      ],
    );
  }

  function iconCpuSmall() {
    return svgIcon(
      { width: '13', height: '13' },
      [
        {
          tag: 'path',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          d: 'M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15-3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0013.5 4.5h-3A2.25 2.25 0 006.75 6.75v10.5A2.25 2.25 0 009 19.5z',
        },
      ],
    );
  }

  function iconBrowser() {
    return svgIcon(
      { width: '14', height: '14' },
      [
        {
          tag: 'circle',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.5',
          cx: '12',
          cy: '12',
          r: '10',
        },
        {
          tag: 'path',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          d: 'M2 12h20',
        },
        {
          tag: 'path',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.5',
          d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z',
        },
      ],
    );
  }

  function portRange(lo, hi) {
    const out = [];
    for (let p = lo; p <= hi; p += 1) {
      out.push(p);
    }
    return out;
  }

  const DEFAULT_MANUAL_DEV_PORT_SET = new Set([
    80,
    443,
    1337,
    2015,
    2368,
    3333,
    4567,
    ...portRange(3000, 3010),
    ...portRange(4000, 4002),
    ...portRange(4200, 4210),
    4300,
    4400,
    4500,
    4600,
    4700,
    4800,
    ...portRange(5000, 5010),
    5050,
    5060,
    ...portRange(5173, 5176),
    5280,
    5432,
    5500,
    5555,
    5601,
    ...portRange(6000, 6010),
    6006,
    6379,
    ...portRange(7000, 7010),
    ...portRange(8000, 8010),
    ...portRange(8080, 8089),
    8443,
    8888,
    9000,
    9001,
    9002,
    9090,
    9229,
    9443,
  ]);

  let allRows = null;
  let currentSettings = null;
  let activeKillJob = null;
  let favoritePortsDraft = [];
  let releaseNotesPendingVersion = null;

  function parseCommaSeparatedPorts(raw) {
    if (!raw || typeof raw !== 'string') {
      return [];
    }
    const out = [];
    for (const part of raw.split(/[\s,;]+/)) {
      if (!part) {
        continue;
      }
      const n = Number.parseInt(part, 10);
      if (Number.isInteger(n) && n >= 1 && n <= 65535) {
        out.push(n);
      }
    }
    return out;
  }

  function analyzePortInput(raw) {
    const parts = String(raw ?? '')
      .split(/[\s,;]+/)
      .filter(Boolean);
    const valid = new Set();
    const invalid = [];
    for (const part of parts) {
      const n = Number.parseInt(part, 10);
      if (Number.isInteger(n) && n >= 1 && n <= 65535) {
        valid.add(n);
      } else {
        invalid.push(part);
      }
    }
    return { valid: Array.from(valid).sort((a, b) => a - b), invalid };
  }

  function parseSinglePort(raw) {
    const n = Number.parseInt(String(raw ?? '').trim(), 10);
    return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : null;
  }

  function buildManualDevAllowlistSet() {
    const set = new Set(DEFAULT_MANUAL_DEV_PORT_SET);
    const text = extraDevPortsInput?.value ?? '';
    for (const p of parseCommaSeparatedPorts(text)) {
      set.add(p);
    }
    return set;
  }

  function applyManualDevFilter(data) {
    if (devManualPortsOnlyInput?.checked !== true) {
      return data;
    }
    const allow = buildManualDevAllowlistSet();
    return data.filter((r) => allow.has(r.port));
  }

  function syncDevOnlyUi() {
    const on = devManualPortsOnlyInput?.checked === true;
    if (extraDevPortsInput) {
      extraDevPortsInput.disabled = !on;
    }
  }

  function persistExtraDevPorts() {
    if (!extraDevPortsInput) {
      return;
    }
    try {
      localStorage.setItem(EXTRA_DEV_PORTS_STORAGE_KEY, extraDevPortsInput.value);
    } catch {}
  }

  function loadExtraDevPortsFromStorage() {
    if (!extraDevPortsInput) {
      return;
    }
    try {
      const s = localStorage.getItem(EXTRA_DEV_PORTS_STORAGE_KEY);
      if (s) {
        extraDevPortsInput.value = s;
      }
    } catch {}
  }

  function isSystemPort(port) {
    return port >= 1 && port <= WELL_KNOWN_PORT_MAX;
  }

  function applySystemPortFilter(data) {
    const show = showSystemPortsInput?.checked === true;
    if (show) {
      return data;
    }
    return data.filter((r) => !isSystemPort(r.port));
  }

  function countLabel(n) {
    return n === 1 ? '1 entry' : `${n} entries`;
  }

  function setStatus(message, kind) {
    if (!snackPanel || !snackText) {
      return;
    }
    snackText.textContent = message;
    applySnackTone(kind);
    const st = String(latestUpdateState?.status || '');
    const updaterBusy =
      st === 'checking' || st === 'available' || st === 'retrying' || st === 'downloading' || st === 'downloaded';
    if (!updaterBusy) {
      if (snackProgress) {
        snackProgress.hidden = true;
      }
      if (installUpdateBtn) {
        installUpdateBtn.hidden = true;
      }
    }
    snackPanel.hidden = false;
    scheduleSnackAutoHide();
  }

  function setLoading(isLoading) {
    if (loading) {
      loading.hidden = !isLoading;
    }
    if (refreshBtn) {
      refreshBtn.disabled = isLoading;
    }
    if (freeProtectedBtn) {
      freeProtectedBtn.disabled = isLoading;
    }
  }

  function formatUpdatePercent(percent) {
    if (!Number.isFinite(percent)) {
      return '0%';
    }
    return `${Math.max(0, Math.min(100, percent)).toFixed(0)}%`;
  }

  function renderUpdateState(state) {
    latestUpdateState = state;
    if (!snackPanel || !snackText || !snackProgress || !installUpdateBtn || !state || typeof state !== 'object') {
      return;
    }
    const status = String(state.status || '');
    if (status === '' || status === 'idle') {
      clearSnackHideTimer();
      snackPanel.hidden = true;
      clearSnackPanelTone();
      return;
    }

    snackPanel.hidden = false;
    snackProgress.hidden = true;
    installUpdateBtn.hidden = true;
    clearSnackPanelTone();

    if (status === 'checking') {
      snackText.textContent = 'Checking for updates...';
      scheduleSnackAutoHide();
      return;
    }
    if (status === 'available') {
      snackText.textContent = state.version
        ? `Update v${String(state.version)} available. Download started...`
        : 'Update available. Download started...';
      scheduleSnackAutoHide();
      return;
    }
    if (status === 'downloading') {
      const percent = Number(state.percent || 0);
      snackText.textContent = `Downloading update... ${formatUpdatePercent(percent)}`;
      snackProgress.hidden = false;
      snackProgress.value = Math.max(0, Math.min(100, percent));
      scheduleSnackAutoHide();
      return;
    }
    if (status === 'retrying') {
      snackText.textContent =
        state.message != null && String(state.message).length > 0
          ? String(state.message)
          : 'Waiting to retry update download…';
      snackProgress.hidden = true;
      installUpdateBtn.hidden = true;
      scheduleSnackAutoHide();
      return;
    }
    if (status === 'downloaded') {
      snackText.textContent = state.version
        ? `Update v${String(state.version)} is ready to install.`
        : 'Update is ready to install.';
      installUpdateBtn.hidden = false;
      if (state.version != null) {
        void maybeShowReleaseNotesForVersion(state.version);
      }
      scheduleSnackAutoHide();
      return;
    }
    if (status === 'up-to-date') {
      snackText.textContent = "You're on the latest version.";
      scheduleSnackAutoHide();
      return;
    }
    if (status === 'error') {
      applySnackTone('error');
      snackText.textContent = state.message ? `Update error: ${String(state.message)}` : 'Update failed.';
      scheduleSnackAutoHide();
      return;
    }
    snackText.textContent = 'Updater status changed.';
    scheduleSnackAutoHide();
  }

  function showKillQueue(message) {
    if (!killQueue) {
      return;
    }
    killQueue.hidden = !message;
    killQueue.textContent = message || '';
  }

  function rowMatchesFilter(row, q) {
    if (!q) {
      return true;
    }
    const s = q.toLowerCase();
    if (
      String(row.port).includes(s) ||
      row.localAddress.toLowerCase().includes(s) ||
      String(row.pid).includes(s) ||
      row.processName.toLowerCase().includes(s) ||
      String(row.state || '').toLowerCase().includes(s)
    ) {
      return true;
    }
    const variants = row.stateVariants;
    if (Array.isArray(variants)) {
      for (const v of variants) {
        if (String(v.state || '').toLowerCase().includes(s) || String(v.foreignAddress || '').toLowerCase().includes(s)) {
          return true;
        }
      }
    }
    return false;
  }

  function compareRowsBySort(a, b) {
    const col = currentSettings?.tableSortColumn ?? 'port';
    const dir = currentSettings?.tableSortDirection === 'desc' ? -1 : 1;
    if (col === 'port') {
      return dir * (a.port - b.port);
    }
    if (col === 'pid') {
      return dir * (a.pid - b.pid);
    }
    if (col === 'process') {
      return dir * String(a.processName).localeCompare(String(b.processName), undefined, { sensitivity: 'base' });
    }
    if (col === 'state') {
      return dir * String(a.state || '').localeCompare(String(b.state || ''), undefined, { sensitivity: 'base' });
    }
    return 0;
  }

  function sortRowsList(rows) {
    const copy = [...rows];
    copy.sort(compareRowsBySort);
    return copy;
  }

  function orderRowsForDisplay(rows) {
    const pinned = new Set(Array.isArray(currentSettings?.pinnedPorts) ? currentSettings.pinnedPorts : []);
    if (pinned.size === 0) {
      return sortRowsList(rows);
    }
    const pinnedRows = [];
    const otherRows = [];
    for (const r of rows) {
      if (pinned.has(r.port)) {
        pinnedRows.push(r);
      } else {
        otherRows.push(r);
      }
    }
    return [...sortRowsList(pinnedRows), ...sortRowsList(otherRows)];
  }

  function formatRowLine(r) {
    return [r.port, r.localAddress, r.pid, r.processName, r.state != null ? r.state : '—'].join('\t');
  }

  async function copyToClipboard(text) {
    const api = window.portKiller;
    if (api && typeof api.writeClipboard === 'function') {
      const res = await api.writeClipboard(text);
      if (res && res.ok === true) {
        setStatus('Copied to clipboard.', 'success');
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied to clipboard.', 'success');
    } catch {
      setStatus('Could not copy to clipboard.', 'error');
    }
  }

  function updateSortHeaderButtons() {
    if (!portsTable) {
      return;
    }
    const col = currentSettings?.tableSortColumn ?? 'port';
    const dir = currentSettings?.tableSortDirection ?? 'asc';
    for (const btn of portsTable.querySelectorAll('.th-sort')) {
      if (!(btn instanceof HTMLButtonElement)) {
        continue;
      }
      const key = btn.dataset.sortKey;
      const active = key === col;
      btn.classList.toggle('th-sort--active', active);
      btn.classList.toggle('th-sort--desc', active && dir === 'desc');
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function applyThemeFromSettings() {
    const t = currentSettings?.theme ?? 'dark';
    document.body.setAttribute('data-theme', t);
  }

  function closeReleaseNotesModal() {
    if (releaseNotesModal) {
      releaseNotesModal.hidden = true;
    }
    releaseNotesPendingVersion = null;
  }

  async function maybeShowReleaseNotesForVersion(version) {
    const v = version != null ? String(version).trim() : '';
    if (!v) {
      return;
    }
    const dismissed = String(currentSettings?.dismissedReleaseNotesVersion ?? '');
    if (dismissed === v) {
      return;
    }
    if (releaseNotesPendingVersion === v) {
      return;
    }
    releaseNotesPendingVersion = v;
    const api = window.portKiller;
    let bodyText = '';
    if (api && typeof api.getReleaseNotes === 'function') {
      const res = await api.getReleaseNotes(v);
      if (res && res.ok === true && typeof res.body === 'string') {
        bodyText = res.body.trim();
      }
    }
    if (!releaseNotesModal || !releaseNotesBody || !releaseNotesVersionLine) {
      return;
    }
    releaseNotesVersionLine.textContent = `Version ${v}`;
    releaseNotesBody.textContent = bodyText.length > 0 ? bodyText : 'No release notes were published for this version.';
    releaseNotesModal.hidden = false;
    releaseNotesOkBtn?.focus();
  }

  async function togglePinnedPort(port) {
    const existing = Array.isArray(currentSettings?.pinnedPorts) ? currentSettings.pinnedPorts : [];
    const nextSet = new Set(existing);
    const wasPinned = nextSet.has(port);
    if (wasPinned) {
      nextSet.delete(port);
    } else {
      nextSet.add(port);
    }
    const next = Array.from(nextSet).sort((a, b) => a - b);
    await saveSettingsFromUi({ pinnedPorts: next });
    setStatus(
      wasPinned ? `Unpinned port ${String(port)}.` : `Pinned port ${String(port)} (shown at top of the list).`,
      'success',
    );
  }

  async function onSortHeaderClick(btn) {
    const key = btn.dataset.sortKey;
    if (!key || !['port', 'pid', 'process', 'state'].includes(key)) {
      return;
    }
    const cur = currentSettings?.tableSortColumn ?? 'port';
    const dir = currentSettings?.tableSortDirection ?? 'asc';
    let nextDir = 'asc';
    if (cur === key) {
      nextDir = dir === 'asc' ? 'desc' : 'asc';
    }
    await saveSettingsFromUi({
      tableSortColumn: key,
      tableSortDirection: nextDir,
    });
    renderFromCache();
  }

  function tcpStateKey(state) {
    return String(state || '')
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
  }

  function buildStateDetailTable(variants) {
    const wrap = document.createElement('div');
    wrap.className = 'state-detail-inner';
    const cap = document.createElement('p');
    cap.className = 'state-detail-caption';
    cap.textContent = 'All TCP states for this socket (same port, address, PID):';
    wrap.appendChild(cap);
    const outer = document.createElement('div');
    outer.className = 'state-detail-table-outer';
    const tbl = document.createElement('table');
    tbl.className = 'state-detail-table';
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    const thState = document.createElement('th');
    thState.scope = 'col';
    thState.className = 'state-detail-th state-detail-th--state';
    thState.textContent = 'State';
    const thRemote = document.createElement('th');
    thRemote.scope = 'col';
    thRemote.className = 'state-detail-th state-detail-th--remote';
    thRemote.textContent = 'Remote endpoint';
    hr.appendChild(thState);
    hr.appendChild(thRemote);
    thead.appendChild(hr);
    tbl.appendChild(thead);
    const tb = document.createElement('tbody');
    for (const v of variants) {
      const tr = document.createElement('tr');
      tr.className = 'state-detail-tr';
      const key = tcpStateKey(v.state);
      if (key) {
        tr.dataset.tcpState = key;
      }
      const tdState = document.createElement('td');
      tdState.className = 'state-detail-td state-detail-td--state';
      const pill = document.createElement('span');
      pill.className = 'state-detail-pill';
      if (key) {
        pill.dataset.tcpState = key;
      }
      pill.textContent = String(v.state || '—');
      tdState.appendChild(pill);
      tr.appendChild(tdState);
      const remote = v.foreignAddress != null && String(v.foreignAddress) !== '' ? String(v.foreignAddress) : '—';
      const tdRemote = document.createElement('td');
      tdRemote.className = 'state-detail-td state-detail-td--remote mono';
      tdRemote.textContent = remote;
      tr.appendChild(tdRemote);
      tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    outer.appendChild(tbl);
    wrap.appendChild(outer);
    return wrap;
  }

  function tdText(text, className) {
    const td = document.createElement('td');
    if (className) {
      td.className = className;
    }
    td.textContent = text;
    return td;
  }

  function applyFilterToDom(source) {
    if (!rowsBody || !countBadge || !emptyHint) {
      return;
    }
    const filteredByPort = applyManualDevFilter(applySystemPortFilter(source));
    const query = filterInput?.value?.trim() ?? '';
    const filtered = query ? filteredByPort.filter((r) => rowMatchesFilter(r, query)) : filteredByPort;
    const ordered = orderRowsForDisplay(filtered);
    const pinnedSet = new Set(Array.isArray(currentSettings?.pinnedPorts) ? currentSettings.pinnedPorts : []);
    const frag = document.createDocumentFragment();
    let visualRow = 0;
    for (const r of ordered) {
      const variants = Array.isArray(r.stateVariants) ? r.stateVariants : null;
      const expandable = variants != null && variants.length > 1;
      const tr = document.createElement('tr');
      tr.className = 'row-main';
      if (pinnedSet.has(r.port)) {
        tr.classList.add('row-main--pinned');
      }
      if (visualRow % 2 === 1) {
        tr.classList.add('row-alt');
      }
      visualRow += 1;
      if (expandable) {
        tr.classList.add('row-expandable');
        tr.setAttribute('role', 'button');
        tr.setAttribute('tabindex', '0');
        tr.setAttribute('aria-expanded', 'false');
        tr.title = 'Click to show all TCP states for this listener';
      }
      tr.appendChild(tdText(String(r.port), 'mono col-port'));
      tr.appendChild(tdText(r.localAddress, 'mono col-address'));
      tr.appendChild(tdText(String(r.pid), 'mono col-pid'));
      tr.appendChild(tdText(r.processName, 'col-process'));
      const stateTd = document.createElement('td');
      const stateUpper = String(r.state || '').toUpperCase().replace(/\s+/g, '_');
      stateTd.classList.add('td-state');
      if (['LISTENING', 'ESTABLISHED', 'TIME_WAIT', 'CLOSE_WAIT', 'SYN_SENT', 'FIN_WAIT_1', 'FIN_WAIT_2'].includes(stateUpper)) {
        stateTd.classList.add(`td-state--${stateUpper.toLowerCase()}`);
      }
      if (expandable) {
        stateTd.classList.add('state-cell-wrap');
        const line = document.createElement('span');
        line.className = 'state-cell-line';
        line.appendChild(document.createTextNode(String(r.state || '—')));
        const hint = document.createElement('span');
        hint.className = 'row-state-hint';
        hint.textContent = ` (+${String(variants.length - 1)})`;
        hint.setAttribute('aria-hidden', 'true');
        line.appendChild(hint);
        stateTd.appendChild(line);
      } else {
        stateTd.appendChild(document.createTextNode(String(r.state || '—')));
      }
      tr.appendChild(stateTd);
      const pinTd = document.createElement('td');
      pinTd.className = 'col-pin';
      const pinBtn = document.createElement('button');
      pinBtn.type = 'button';
      pinBtn.className = 'btn btn-table btn-pin-toggle';
      pinBtn.dataset.pinPort = String(r.port);
      const isPinned = pinnedSet.has(r.port);
      pinBtn.replaceChildren(iconPin());
      pinBtn.classList.toggle('btn-pin-toggle--active', isPinned);
      pinBtn.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
      pinBtn.setAttribute('aria-label', isPinned ? `Unpin port ${String(r.port)}` : `Pin port ${String(r.port)} to top of list`);
      pinBtn.title = isPinned ? 'Unpin row' : 'Pin row (keeps this port at the top)';
      pinTd.appendChild(pinBtn);
      tr.appendChild(pinTd);
      const favoriteTd = document.createElement('td');
      favoriteTd.className = 'col-favorite';
      const favoriteBtn = document.createElement('button');
      favoriteBtn.type = 'button';
      favoriteBtn.className = 'btn btn-table btn-favorite-toggle';
      favoriteBtn.dataset.favoritePort = String(r.port);
      const favorite = isFavoritePort(r.port);
      const glyph = document.createElement('span');
      glyph.className = 'favorite-glyph';
      glyph.appendChild(iconStar(favorite));
      favoriteBtn.appendChild(glyph);
      favoriteBtn.classList.toggle('btn-favorite-toggle--active', favorite);
      favoriteBtn.setAttribute(
        'aria-label',
        favorite ? `Remove port ${String(r.port)} from favorites` : `Add port ${String(r.port)} to favorites`,
      );
      favoriteBtn.title = favorite ? 'Remove from favorites' : 'Add to favorites';
      favoriteTd.appendChild(favoriteBtn);
      tr.appendChild(favoriteTd);
      const copyTd = document.createElement('td');
      copyTd.className = 'col-copy';
      const copyWrap = document.createElement('div');
      copyWrap.className = 'copy-actions';
      const mkCopyBtn = (title, text, iconFactory) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-table btn-copy-micro';
        b.title = title;
        b.dataset.copyText = text;
        const wrap = document.createElement('span');
        wrap.className = 'btn-copy-micro__inner';
        wrap.appendChild(iconFactory());
        b.appendChild(wrap);
        return b;
      };
      copyWrap.appendChild(mkCopyBtn('Copy port', String(r.port), iconHashSmall));
      copyWrap.appendChild(mkCopyBtn('Copy PID', String(r.pid), iconCpuSmall));
      copyWrap.appendChild(mkCopyBtn('Copy full row', formatRowLine(r), iconClipboard));
      copyTd.appendChild(copyWrap);
      tr.appendChild(copyTd);

      const openTd = document.createElement('td');
      openTd.className = 'col-open';
      const openWrap = document.createElement('div');
      openWrap.className = 'open-actions';
      const browserBtn = document.createElement('button');
      browserBtn.type = 'button';
      browserBtn.className = 'btn btn-table btn-browser';
      browserBtn.title = `Open http://localhost:${String(r.port)}`;
      browserBtn.dataset.browserPort = String(r.port);
      browserBtn.appendChild(iconBrowser());
      openWrap.appendChild(browserBtn);
      openTd.appendChild(openWrap);
      tr.appendChild(openTd);

      const actionTd = document.createElement('td');
      actionTd.className = 'col-action';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-danger btn-table';
      btn.textContent = 'Kill';
      btn.dataset.pid = String(r.pid);
      btn.dataset.name = r.processName;
      btn.dataset.port = String(r.port);
      actionTd.appendChild(btn);
      tr.appendChild(actionTd);
      frag.appendChild(tr);
      if (expandable) {
        const detailTr = document.createElement('tr');
        detailTr.className = 'row-detail';
        detailTr.hidden = true;
        const detailTd = document.createElement('td');
        detailTd.colSpan = 10;
        detailTd.appendChild(buildStateDetailTable(variants));
        detailTr.appendChild(detailTd);
        frag.appendChild(detailTr);
      }
    }
    rowsBody.replaceChildren(frag);
    countBadge.textContent = countLabel(filtered.length);
    emptyHint.hidden = filtered.length > 0;
    updateSortHeaderButtons();
  }

  function renderFromCache(rows) {
    const data = rows ?? allRows;
    if (!data) {
      return;
    }
    applyFilterToDom(data);
  }

  async function refresh() {
    const api = window.portKiller;
    if (!api) {
      setStatus('App bridge not available. Restart the application.', 'error');
      return;
    }
    setLoading(true);
    setStatus('Loading…');
    try {
      const res = await api.getPorts();
      if (!res || typeof res !== 'object') {
        setStatus('Unexpected response.', 'error');
        return;
      }
      if (res.ok && Array.isArray(res.data)) {
        allRows = res.data;
        setStatus('Ready.');
        renderFromCache();
      } else {
        const err = 'error' in res && res.error != null ? String(res.error) : 'Unknown error';
        setStatus(`Failed: ${err}`, 'error');
        allRows = [];
        renderFromCache([]);
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setStatus(`Failed: ${m}`, 'error');
      allRows = [];
      renderFromCache([]);
    } finally {
      setLoading(false);
    }
  }

  function applySettingsToUi(settings) {
    currentSettings = settings;
    if (killTreeInput) {
      killTreeInput.checked = settings.killProcessTree === true;
    }
    if (killDelayInput) {
      killDelayInput.value = String(settings.killDelaySeconds ?? 5);
    }
    if (minimizeToTrayInput) {
      minimizeToTrayInput.checked = settings.minimizeToTray === true;
    }
    applyThemeFromSettings();
    updateSortHeaderButtons();
  }

  async function saveSettingsFromUi(patch = {}) {
    const api = window.portKiller;
    if (!api || typeof api.setSettings !== 'function') {
      return;
    }
    const next = await api.setSettings({
      killProcessTree: killTreeInput?.checked === true,
      killDelaySeconds: Math.max(0, Math.min(30, Number.parseInt(killDelayInput?.value ?? '5', 10) || 5)),
      minimizeToTray: minimizeToTrayInput?.checked === true,
      ...patch,
    });
    applySettingsToUi(next);
  }

  function openProtectedPortsModal() {
    const existing = Array.isArray(currentSettings?.protectedPorts) ? currentSettings.protectedPorts : [];
    favoritePortsDraft = [...existing].sort((a, b) => a - b);
    renderFavoritePortsDraft();
    if (protectedPortsModalInput) {
      protectedPortsModalInput.value = '';
    }
    if (protectedPortsModal) {
      protectedPortsModal.hidden = false;
    }
    updateProtectedPortsModalFeedback();
    protectedPortsModalInput?.focus();
    protectedPortsModalInput?.select();
  }

  function closeProtectedPortsModal() {
    if (protectedPortsModal) {
      protectedPortsModal.hidden = true;
    }
  }

  async function saveProtectedPortsFromModal() {
    const parsed = [...favoritePortsDraft].sort((a, b) => a - b);
    await saveSettingsFromUi({ protectedPorts: parsed });
    setStatus(`Favorite ports updated (${parsed.length} configured).`, 'success');
    closeProtectedPortsModal();
  }

  function renderFavoritePortsDraft() {
    if (!favoritePortsList) {
      return;
    }
    if (favoritePortsDraft.length === 0) {
      favoritePortsList.innerHTML = '<span class="favorite-port-empty">No favorite ports yet.</span>';
      updateProtectedPortsModalFeedback();
      return;
    }
    const frag = document.createDocumentFragment();
    for (const port of favoritePortsDraft) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'favorite-port-card';
      chip.dataset.favoritePort = String(port);
      chip.textContent = `${String(port)} ×`;
      chip.title = `Remove ${String(port)}`;
      frag.appendChild(chip);
    }
    favoritePortsList.replaceChildren(frag);
    updateProtectedPortsModalFeedback();
  }

  function isFavoritePort(port) {
    const ports = Array.isArray(currentSettings?.protectedPorts) ? currentSettings.protectedPorts : [];
    return ports.includes(port);
  }

  async function toggleFavoritePort(port) {
    const existing = Array.isArray(currentSettings?.protectedPorts) ? currentSettings.protectedPorts : [];
    const nextSet = new Set(existing);
    const currentlyFavorite = nextSet.has(port);
    if (currentlyFavorite) {
      nextSet.delete(port);
    } else {
      nextSet.add(port);
    }
    const next = Array.from(nextSet).sort((a, b) => a - b);
    await saveSettingsFromUi({ protectedPorts: next });
    setStatus(
      currentlyFavorite ? `Removed ${String(port)} from favorite ports.` : `Added ${String(port)} to favorite ports.`,
      'success',
    );
  }

  function addFavoritePortFromInput() {
    const parsed = parseSinglePort(protectedPortsModalInput?.value ?? '');
    if (parsed == null) {
      updateProtectedPortsModalFeedback('Enter a valid port (1-65535).');
      return;
    }
    if (!favoritePortsDraft.includes(parsed)) {
      favoritePortsDraft.push(parsed);
      favoritePortsDraft.sort((a, b) => a - b);
    }
    if (protectedPortsModalInput) {
      protectedPortsModalInput.value = '';
    }
    renderFavoritePortsDraft();
    protectedPortsModalInput?.focus();
  }

  function updateProtectedPortsModalFeedback(forcedErrorMessage) {
    if (!protectedPortsModalFeedback) {
      return;
    }
    const { invalid } = analyzePortInput(protectedPortsModalInput?.value ?? '');
    protectedPortsModalFeedback.classList.remove('modal-feedback--error', 'modal-feedback--ok');
    if (typeof forcedErrorMessage === 'string' && forcedErrorMessage.length > 0) {
      protectedPortsModalFeedback.classList.add('modal-feedback--error');
      protectedPortsModalFeedback.textContent = forcedErrorMessage;
      if (protectedPortsSaveBtn) {
        protectedPortsSaveBtn.disabled = true;
      }
      return;
    }
    if (invalid.length > 0) {
      protectedPortsModalFeedback.classList.add('modal-feedback--error');
      protectedPortsModalFeedback.textContent = `Invalid: ${invalid.join(', ')}. Use ports 1-65535.`;
      if (protectedPortsSaveBtn) {
        protectedPortsSaveBtn.disabled = true;
      }
      return;
    }
    protectedPortsModalFeedback.classList.add('modal-feedback--ok');
    protectedPortsModalFeedback.textContent =
      favoritePortsDraft.length > 0
        ? `${favoritePortsDraft.length} favorite port(s) configured.`
        : 'No favorite ports configured.';
    if (protectedPortsSaveBtn) {
      protectedPortsSaveBtn.disabled = false;
    }
  }

  function formatHistoryEntry(entry) {
    const date = new Date(entry.timestamp);
    const time = Number.isNaN(date.getTime()) ? entry.timestamp : date.toLocaleTimeString();
    return `${time} · PID ${String(entry.pid)} · ${String(entry.processName)} · port ${entry.port ?? 'n/a'} · ${String(entry.outcome)}`;
  }

  async function refreshHistory() {
    const api = window.portKiller;
    if (!api || typeof api.getKillHistory !== 'function' || !historyList) {
      return;
    }
    const res = await api.getKillHistory();
    if (!res || res.ok !== true || !Array.isArray(res.data) || res.data.length === 0) {
      historyList.innerHTML = '<li class="history-empty">No actions yet.</li>';
      return;
    }
    const frag = document.createDocumentFragment();
    for (const item of res.data) {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.textContent = formatHistoryEntry(item);
      frag.appendChild(li);
    }
    historyList.replaceChildren(frag);
  }

  async function confirmKill(pid, name) {
    return window.confirm(`Kill process "${name}" (PID ${String(pid)})?`);
  }

  function toggleRowDetail(mainRow) {
    const detail = mainRow.nextElementSibling;
    if (!detail || !detail.classList.contains('row-detail')) {
      return;
    }
    detail.hidden = !detail.hidden;
    const open = !detail.hidden;
    mainRow.classList.toggle('row-expanded', open);
    mainRow.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function cancelActiveKill() {
    if (!activeKillJob) {
      return;
    }
    activeKillJob.cancelled = true;
    clearInterval(activeKillJob.intervalId);
    activeKillJob.resolve();
    activeKillJob = null;
    showKillQueue('');
    setStatus('Kill action cancelled.');
  }

  async function killWithDelay(target) {
    const api = window.portKiller;
    if (!api) {
      return { ok: false, error: 'App bridge not available.' };
    }
    const settings = currentSettings ?? (await api.getSettings());
    const delaySeconds = Math.max(0, Number(settings.killDelaySeconds || 0));
    const tree = settings.killProcessTree === true;
    if (delaySeconds > 0) {
      let remaining = delaySeconds + 1;
      let resolveWait = () => {};
      const waitPromise = new Promise((resolve) => {
        resolveWait = resolve;
      });
      activeKillJob = {
        cancelled: false,
        resolve: resolveWait,
        intervalId: null,
      };
      const tick = () => {
        remaining -= 1;
        if (remaining <= 0) {
          resolveWait();
          return;
        }
        showKillQueue(`Stopping PID ${String(target.pid)} in ${String(remaining)}s. Click to cancel.`);
      };
      tick();
      activeKillJob.intervalId = window.setInterval(tick, 1000);
      await waitPromise;
      const cancelled = activeKillJob?.cancelled === true;
      if (activeKillJob) {
        clearInterval(activeKillJob.intervalId);
      }
      activeKillJob = null;
      if (cancelled) {
        return { ok: false, error: 'Cancelled by user' };
      }
      showKillQueue('');
    }
    const result = await api.killProcess({
      pid: target.pid,
      processName: target.processName,
      port: target.port,
      tree,
    });
    await refreshHistory();
    return result;
  }

  async function onRowsBodyClick(ev) {
    const browserBtnEl = ev.target.closest('button.btn-browser');
    if (browserBtnEl instanceof HTMLButtonElement && browserBtnEl.dataset.browserPort != null) {
      ev.stopPropagation();
      const port = Number.parseInt(browserBtnEl.dataset.browserPort, 10);
      if (!Number.isInteger(port)) {
        return;
      }
      const api = window.portKiller;
      if (api && typeof api.openInBrowser === 'function') {
        await api.openInBrowser(port);
        setStatus(`Opened http://localhost:${String(port)} in browser.`, 'success');
      }
      return;
    }

    const copyBtn = ev.target.closest('button.btn-copy-micro');
    if (copyBtn instanceof HTMLButtonElement && copyBtn.dataset.copyText != null) {
      ev.stopPropagation();
      await copyToClipboard(String(copyBtn.dataset.copyText));
      return;
    }

    const pinBtnEl = ev.target.closest('button.btn-pin-toggle');
    if (pinBtnEl instanceof HTMLButtonElement && pinBtnEl.dataset.pinPort != null) {
      ev.stopPropagation();
      const port = Number.parseInt(pinBtnEl.dataset.pinPort, 10);
      if (!Number.isInteger(port)) {
        return;
      }
      pinBtnEl.disabled = true;
      try {
        await togglePinnedPort(port);
        renderFromCache();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Could not update pinned port ${String(port)}: ${message}`, 'error');
      } finally {
        pinBtnEl.disabled = false;
      }
      return;
    }

    const favoriteBtn = ev.target.closest('button.btn-favorite-toggle');
    if (favoriteBtn instanceof HTMLButtonElement && favoriteBtn.dataset.favoritePort != null) {
      const port = Number.parseInt(favoriteBtn.dataset.favoritePort, 10);
      if (!Number.isInteger(port)) {
        return;
      }
      favoriteBtn.disabled = true;
      try {
        await toggleFavoritePort(port);
        renderFromCache();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Could not update favorite port ${String(port)}: ${message}`, 'error');
      } finally {
        favoriteBtn.disabled = false;
      }
      return;
    }

    const btn = ev.target.closest('button.btn-danger');
    if (btn instanceof HTMLButtonElement && btn.dataset.pid != null) {
      const pid = Number.parseInt(btn.dataset.pid, 10);
      if (Number.isNaN(pid)) {
        return;
      }
      const name = btn.dataset.name != null && btn.dataset.name !== '' ? btn.dataset.name : 'unknown';
      const port = btn.dataset.port != null ? Number.parseInt(btn.dataset.port, 10) : null;
      if (!(await confirmKill(pid, name))) {
        return;
      }
      setStatus(`Stopping PID ${String(pid)}…`);
      const result = await killWithDelay({ pid, processName: name, port });
      if (result && result.ok) {
        setStatus(`Stopped PID ${String(pid)}.`, 'success');
      } else {
        const err = result && result.error != null ? String(result.error) : 'Failed';
        setStatus(`Could not stop PID ${String(pid)}: ${err}`, 'error');
      }
      await refresh();
      return;
    }
    const mainRow = ev.target.closest('tr.row-expandable');
    if (mainRow instanceof HTMLTableRowElement && rowsBody && rowsBody.contains(mainRow)) {
      toggleRowDetail(mainRow);
    }
  }

  function onRowsBodyKeydown(ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') {
      return;
    }
    const mainRow = ev.target.closest('tr.row-expandable');
    if (!(mainRow instanceof HTMLTableRowElement) || !rowsBody || !rowsBody.contains(mainRow)) {
      return;
    }
    ev.preventDefault();
    toggleRowDetail(mainRow);
  }

  async function checkForUpdatesFromUi() {
    const api = window.portKiller;
    if (!api || typeof api.checkForUpdates !== 'function') {
      setStatus('Update check is not available.', 'error');
      return;
    }
    if (checkUpdatesBtn) {
      checkUpdatesBtn.disabled = true;
    }
    setStatus('Checking for updates…');
    renderUpdateState({ status: 'checking' });
    try {
      const res = await api.checkForUpdates();
      if (!res || typeof res !== 'object') {
        setStatus('Unexpected response from update check.', 'error');
        return;
      }
      if (res.ok === false) {
        setStatus(res.message != null ? String(res.message) : 'Could not check for updates.', 'error');
        return;
      }
      if (res.status === 'available' && res.version != null) {
        setStatus(`Update available: v${String(res.version)}.`, 'success');
        renderUpdateState({ status: 'available', version: res.version });
      } else {
        setStatus("You're on the latest version.", 'success');
        renderUpdateState({ status: 'up-to-date' });
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setStatus(`Update check failed: ${m}`, 'error');
    } finally {
      if (checkUpdatesBtn) {
        checkUpdatesBtn.disabled = false;
      }
    }
  }

  async function installDownloadedUpdateFromUi() {
    const api = window.portKiller;
    if (!api || typeof api.installDownloadedUpdate !== 'function') {
      setStatus('Install update action is not available.', 'error');
      return;
    }
    if (latestUpdateState?.status !== 'downloaded') {
      setStatus('The update is not ready to install yet.', 'error');
      return;
    }
    if (installUpdateBtn) {
      installUpdateBtn.disabled = true;
    }
    setStatus('Closing app to install update...');
    try {
      const res = await api.installDownloadedUpdate();
      if (!res || res.ok !== true) {
        setStatus(`Could not install update: ${String(res?.error || 'Failed')}`, 'error');
        if (installUpdateBtn) {
          installUpdateBtn.disabled = false;
        }
      }
    } catch (error) {
      setStatus(`Could not install update: ${error instanceof Error ? error.message : String(error)}`, 'error');
      if (installUpdateBtn) {
        installUpdateBtn.disabled = false;
      }
    }
  }

  async function freeProtectedFromUi() {
    const api = window.portKiller;
    if (!api || typeof api.freeProtectedPorts !== 'function') {
      setStatus('Protected-port action is not available.', 'error');
      return;
    }
    const ports = Array.isArray(currentSettings?.protectedPorts) ? currentSettings.protectedPorts : [];
    if (!window.confirm(`Free favorite ports now (${ports.join(', ') || 'none configured'})?`)) {
      return;
    }
    const result = await api.freeProtectedPorts();
    await refresh();
    await refreshHistory();
    if (result && result.ok) {
      setStatus(
        result.killed === 0
          ? 'No listeners were using favorite ports.'
          : `Stopped ${String(result.killed)} process(es) on favorite ports.`,
        'success',
      );
      return;
    }
    setStatus(`Could not free favorite ports: ${String(result?.error || 'Failed')}`, 'error');
  }

  if (rowsBody) {
    rowsBody.addEventListener('click', (e) => void onRowsBodyClick(e));
    rowsBody.addEventListener('keydown', onRowsBodyKeydown);
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => void refresh());
  }
  if (freeProtectedBtn) {
    freeProtectedBtn.addEventListener('click', () => void freeProtectedFromUi());
  }
  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', () => void checkForUpdatesFromUi());
  }
  if (installUpdateBtn) {
    installUpdateBtn.addEventListener('click', () => void installDownloadedUpdateFromUi());
  }
  if (filterInput) {
    filterInput.addEventListener('input', () => renderFromCache());
  }
  if (showSystemPortsInput) {
    showSystemPortsInput.addEventListener('change', () => renderFromCache());
  }
  if (devManualPortsOnlyInput) {
    devManualPortsOnlyInput.addEventListener('change', () => {
      syncDevOnlyUi();
      renderFromCache();
    });
  }
  if (extraDevPortsInput) {
    extraDevPortsInput.addEventListener('input', () => {
      persistExtraDevPorts();
      renderFromCache();
    });
  }
  if (protectedPortsBtn) {
    protectedPortsBtn.addEventListener('click', openProtectedPortsModal);
  }
  if (protectedPortsCancelBtn) {
    protectedPortsCancelBtn.addEventListener('click', closeProtectedPortsModal);
  }
  if (protectedPortsSaveBtn) {
    protectedPortsSaveBtn.addEventListener('click', () => void saveProtectedPortsFromModal());
  }
  if (protectedPortsModalInput) {
    protectedPortsModalInput.addEventListener('input', () => updateProtectedPortsModalFeedback());
    protectedPortsModalInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addFavoritePortFromInput();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeProtectedPortsModal();
      }
    });
  }
  if (protectedPortsAddBtn) {
    protectedPortsAddBtn.addEventListener('click', addFavoritePortFromInput);
  }
  if (favoritePortsList) {
    favoritePortsList.addEventListener('click', (event) => {
      const target = event.target.closest('[data-favorite-port]');
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const p = Number.parseInt(target.dataset.favoritePort ?? '', 10);
      if (!Number.isInteger(p)) {
        return;
      }
      favoritePortsDraft = favoritePortsDraft.filter((port) => port !== p);
      renderFavoritePortsDraft();
    });
  }
  if (protectedPortsModal) {
    protectedPortsModal.addEventListener('click', (event) => {
      if (event.target === protectedPortsModal) {
        closeProtectedPortsModal();
      }
    });
    protectedPortsModal.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-port-chip]');
      if (!(chip instanceof HTMLElement) || !protectedPortsModalInput) {
        return;
      }
      const value = chip.dataset.portChip;
      if (!value) {
        return;
      }
      if (value === 'clear') {
        favoritePortsDraft = [];
        renderFavoritePortsDraft();
        return;
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed)) {
        return;
      }
      if (!favoritePortsDraft.includes(parsed)) {
        favoritePortsDraft.push(parsed);
        favoritePortsDraft.sort((a, b) => a - b);
      }
      renderFavoritePortsDraft();
    });
  }
  if (killTreeInput) {
    killTreeInput.addEventListener('change', () => void saveSettingsFromUi());
  }
  if (killDelayInput) {
    killDelayInput.addEventListener('change', () => void saveSettingsFromUi());
  }
  if (minimizeToTrayInput) {
    minimizeToTrayInput.addEventListener('change', () => void saveSettingsFromUi());
  }
  if (killQueue) {
    killQueue.addEventListener('click', cancelActiveKill);
  }
  if (historyRefreshBtn) {
    historyRefreshBtn.addEventListener('click', () => void refreshHistory());
  }
  if (portsTable) {
    portsTable.addEventListener('click', (ev) => {
      const sortBtn = ev.target.closest('.th-sort');
      if (sortBtn instanceof HTMLButtonElement) {
        ev.preventDefault();
        void onSortHeaderClick(sortBtn);
      }
    });
  }
  if (releaseNotesOkBtn) {
    releaseNotesOkBtn.addEventListener('click', async () => {
      const v = releaseNotesPendingVersion != null ? String(releaseNotesPendingVersion) : '';
      if (v) {
        await saveSettingsFromUi({ dismissedReleaseNotesVersion: v });
      }
      closeReleaseNotesModal();
    });
  }
  if (releaseNotesModal) {
    releaseNotesModal.addEventListener('click', (ev) => {
      if (ev.target === releaseNotesModal) {
        releaseNotesOkBtn?.click();
      }
    });
  }

  loadExtraDevPortsFromStorage();
  syncDevOnlyUi();

  const api = window.portKiller;
  if (api && typeof api.onTrayRefresh === 'function') {
    api.onTrayRefresh(() => void refresh());
  }
  if (api && typeof api.onHistoryUpdated === 'function') {
    api.onHistoryUpdated(() => void refreshHistory());
  }
  if (api && typeof api.onUpdaterEvent === 'function') {
    api.onUpdaterEvent((state) => {
      renderUpdateState(state);
    });
  }

  async function boot() {
    if (api && typeof api.getSettings === 'function') {
      applySettingsToUi(await api.getSettings());
    }
    if (api && typeof api.getUpdateState === 'function') {
      renderUpdateState(await api.getUpdateState());
    }
    await refresh();
    await refreshHistory();
  }

  void boot();
})();
