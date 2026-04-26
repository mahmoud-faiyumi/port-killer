(function () {
  'use strict';

  const rowsBody = document.getElementById('rows-body');
  const refreshBtn = document.querySelector('#refresh-btn');
  const checkUpdatesBtn = document.querySelector('#check-updates-btn');
  const filterInput = document.querySelector('#filter-input');
  const showSystemPortsInput = document.querySelector('#show-system-ports');
  const devManualPortsOnlyInput = document.querySelector('#dev-manual-ports-only');
  const extraDevPortsInput = document.querySelector('#extra-dev-ports');
  const countBadge = document.getElementById('count-badge');
  const statusBar = document.getElementById('status-bar');
  const loading = document.getElementById('loading');
  const emptyHint = document.getElementById('empty-hint');

  const WELL_KNOWN_PORT_MAX = 1023;

  const EXTRA_DEV_PORTS_STORAGE_KEY = 'portKiller.devPortsExtra';

  function portRange(lo, hi) {
    const out = [];
    for (let p = lo; p <= hi; p += 1) {
      out.push(p);
    }
    return out;
  }

  const DEFAULT_MANUAL_DEV_PORT_SET = new Set(
    [
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
    ],
  );

  let allRows = null;

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
    } catch {
    }
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
    } catch {
    }
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
    if (n === 1) {
      return '1 entry';
    }
    return `${n} entries`;
  }

  function setStatus(message, kind) {
    if (!statusBar) {
      return;
    }
    statusBar.textContent = message;
    const isError = kind === 'error';
    const isSuccess = kind === 'success';
    statusBar.classList.toggle('status-bar--error', isError);
    statusBar.classList.toggle('status-bar--success', isSuccess && !isError);
  }

  function setLoading(isLoading) {
    if (loading) {
      loading.hidden = !isLoading;
    }
    if (refreshBtn) {
      refreshBtn.disabled = isLoading;
    }
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
        const st = String(v.state || '').toLowerCase();
        const fr = String(v.foreignAddress || '').toLowerCase();
        if (st.includes(s) || fr.includes(s)) {
          return true;
        }
      }
    }
    return false;
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

  function applyFilterToDom(source) {
    if (!rowsBody || !countBadge || !emptyHint) {
      return;
    }
    const afterSystem = applySystemPortFilter(source);
    const afterManual = applyManualDevFilter(afterSystem);
    const q = filterInput?.value?.trim() ?? '';
    const filtered = q
      ? afterManual.filter((r) => rowMatchesFilter(r, q))
      : afterManual;

    const frag = document.createDocumentFragment();
    let visualRow = 0;
    for (const r of filtered) {
      const variants = Array.isArray(r.stateVariants) ? r.stateVariants : null;
      const expandable = variants != null && variants.length > 1;

      const tr = document.createElement('tr');
      tr.className = 'row-main';
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

      const actionTd = document.createElement('td');
      actionTd.className = 'col-action';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-danger btn-table';
      btn.textContent = 'Kill';
      btn.dataset.pid = String(r.pid);
      btn.dataset.name = r.processName;
      actionTd.appendChild(btn);
      tr.appendChild(actionTd);
      frag.appendChild(tr);

      if (expandable) {
        const detailTr = document.createElement('tr');
        detailTr.className = 'row-detail';
        detailTr.hidden = true;
        const detailTd = document.createElement('td');
        detailTd.colSpan = 6;
        detailTd.appendChild(buildStateDetailTable(variants));
        detailTr.appendChild(detailTd);
        frag.appendChild(detailTr);
      }
    }
    rowsBody.replaceChildren(frag);
    countBadge.textContent = countLabel(filtered.length);
    emptyHint.hidden = filtered.length > 0;
  }

  function tdText(text, className) {
    const td = document.createElement('td');
    if (className) {
      td.className = className;
    }
    td.textContent = text;
    return td;
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

  async function confirmKill(pid, name) {
    const line = `Kill process "${name}" (PID ${String(pid)})? This cannot be undone.`;
    return window.confirm(line);
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

  async function onRowsBodyClick(ev) {
    const btn = ev.target.closest('button.btn-danger');
    if (btn instanceof HTMLButtonElement && btn.dataset.pid != null) {
      const pid = Number.parseInt(btn.dataset.pid, 10);
      if (Number.isNaN(pid)) {
        return;
      }
      const name = btn.dataset.name != null && btn.dataset.name !== '' ? btn.dataset.name : 'unknown';
      const ok = await confirmKill(pid, name);
      if (!ok) {
        return;
      }
      const api = window.portKiller;
      if (!api) {
        setStatus('App bridge not available.', 'error');
        return;
      }
      setStatus(`Stopping PID ${String(pid)}…`);
      const result = await api.killProcess(pid);
      if (result && result.ok) {
        setStatus(`Stopped PID ${String(pid)}.`, 'success');
      } else {
        const err = result && 'error' in result && result.error != null ? String(result.error) : 'Failed';
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

  if (rowsBody) {
    rowsBody.addEventListener('click', (e) => {
      void onRowsBodyClick(e);
    });
    rowsBody.addEventListener('keydown', onRowsBodyKeydown);
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      void refresh();
    });
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
    try {
      const res = await api.checkForUpdates();
      if (!res || typeof res !== 'object') {
        setStatus('Unexpected response from update check.', 'error');
        return;
      }
      if (res.ok === false) {
        const msg =
          res.message != null
            ? String(res.message)
            : res.reason === 'not-applicable'
              ? 'Updates only run in the installed Windows app.'
              : 'Could not check for updates.';
        setStatus(msg, res.reason === 'not-applicable' ? undefined : 'error');
        return;
      }
      if (res.status === 'available' && res.version != null) {
        setStatus(
          `Update available: v${String(res.version)}. Follow the system notification when the download finishes, or restart the app after installing.`,
          'success',
        );
        return;
      }
      setStatus("You're on the latest version.", 'success');
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setStatus(`Update check failed: ${m}`, 'error');
    } finally {
      if (checkUpdatesBtn) {
        checkUpdatesBtn.disabled = false;
      }
    }
  }

  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', () => {
      void checkForUpdatesFromUi();
    });
  }
  if (filterInput) {
    filterInput.addEventListener('input', () => {
      renderFromCache();
    });
  }
  if (showSystemPortsInput) {
    showSystemPortsInput.addEventListener('change', () => {
      renderFromCache();
    });
  }
  loadExtraDevPortsFromStorage();
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
  syncDevOnlyUi();

  void refresh();
})();
