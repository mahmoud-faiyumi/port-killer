(function () {
  'use strict';

  /** @type {HTMLElement | null} */
  const rowsBody = document.getElementById('rows-body');
  /** @type {HTMLButtonElement | null} */
  const refreshBtn = document.querySelector('#refresh-btn');
  /** @type {HTMLInputElement | null} */
  const filterInput = document.querySelector('#filter-input');
  /** @type {HTMLInputElement | null} */
  const showSystemPortsInput = document.querySelector('#show-system-ports');
  /** @type {HTMLInputElement | null} */
  const devManualPortsOnlyInput = document.querySelector('#dev-manual-ports-only');
  /** @type {HTMLInputElement | null} */
  const extraDevPortsInput = document.querySelector('#extra-dev-ports');
  /** @type {HTMLElement | null} */
  const countBadge = document.getElementById('count-badge');
  /** @type {HTMLElement | null} */
  const statusBar = document.getElementById('status-bar');
  /** @type {HTMLElement | null} */
  const loading = document.getElementById('loading');
  /** @type {HTMLElement | null} */
  const emptyHint = document.getElementById('empty-hint');

  /**
   * @typedef {Object} PortRow
   * @property {number} port
   * @property {string} localAddress
   * @property {number} pid
   * @property {string} processName
   * @property {string} state
   */

  /** IANA well-known port range; hidden when "Show system ports" is off. */
  const WELL_KNOWN_PORT_MAX = 1023;

  const EXTRA_DEV_PORTS_STORAGE_KEY = 'portKiller.devPortsExtra';

  /**
   * @param {number} lo
   * @param {number} hi
   * @returns {number[]}
   */
  function portRange(lo, hi) {
    const out = [];
    for (let p = lo; p <= hi; p += 1) {
      out.push(p);
    }
    return out;
  }

  /** Preset “manual / dev” ports (HTTP stacks, SPA dev servers, bundlers, DBs on localhost, etc.). */
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
      8080,
      8081,
      8082,
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

  /** @type {PortRow[] | null} */
  let allRows = null;

  /**
   * @param {string} raw
   * @returns {number[]}
   */
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

  /**
   * @returns {Set<number>}
   */
  function buildManualDevAllowlistSet() {
    const set = new Set(DEFAULT_MANUAL_DEV_PORT_SET);
    const text = extraDevPortsInput?.value ?? '';
    for (const p of parseCommaSeparatedPorts(text)) {
      set.add(p);
    }
    return set;
  }

  /**
   * @param {PortRow[]} data
   * @returns {PortRow[]}
   */
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
      // ignore (private mode, file:// restrictions in some embeds)
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
      // ignore
    }
  }

  /**
   * @param {number} port
   * @returns {boolean}
   */
  function isSystemPort(port) {
    return port >= 1 && port <= WELL_KNOWN_PORT_MAX;
  }

  /**
   * @param {PortRow[]} data
   * @returns {PortRow[]}
   */
  function applySystemPortFilter(data) {
    const show = showSystemPortsInput?.checked === true;
    if (show) {
      return data;
    }
    return data.filter((r) => !isSystemPort(r.port));
  }

  /**
   * @param {number} n
   * @returns {string}
   */
  function countLabel(n) {
    if (n === 1) {
      return '1 entry';
    }
    return `${n} entries`;
  }

  /**
   * @param {string} message
   * @param {boolean} isError
   */
  function setStatus(message, isError) {
    if (!statusBar) {
      return;
    }
    statusBar.textContent = message;
    statusBar.classList.toggle('status-bar--error', isError);
  }

  /**
   * @param {boolean} isLoading
   */
  function setLoading(isLoading) {
    if (loading) {
      loading.hidden = !isLoading;
    }
    if (refreshBtn) {
      refreshBtn.disabled = isLoading;
    }
  }

  /**
   * @param {PortRow} row
   * @param {string} q
   * @returns {boolean}
   */
  function rowMatchesFilter(row, q) {
    if (!q) {
      return true;
    }
    const s = q.toLowerCase();
    return (
      String(row.port).includes(s) ||
      row.localAddress.toLowerCase().includes(s) ||
      String(row.pid).includes(s) ||
      row.processName.toLowerCase().includes(s) ||
      row.state.toLowerCase().includes(s)
    );
  }

  /**
   * @param {PortRow[]} source
   */
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
    for (const r of filtered) {
      const tr = document.createElement('tr');
      tr.appendChild(tdText(String(r.port), 'mono'));
      tr.appendChild(tdText(r.localAddress, 'mono'));
      tr.appendChild(tdText(String(r.pid), 'mono'));
      tr.appendChild(tdText(r.processName, undefined));
      tr.appendChild(tdText(r.state, undefined));
      const actionTd = document.createElement('td');
      actionTd.className = 'col-action';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-danger';
      btn.textContent = 'Kill';
      btn.dataset.pid = String(r.pid);
      btn.dataset.name = r.processName;
      actionTd.appendChild(btn);
      tr.appendChild(actionTd);
      frag.appendChild(tr);
    }
    rowsBody.replaceChildren(frag);
    countBadge.textContent = countLabel(filtered.length);
    emptyHint.hidden = filtered.length > 0;
  }

  /**
   * @param {string} text
   * @param {string} [className]
   * @returns {HTMLTableCellElement}
   */
  function tdText(text, className) {
    const td = document.createElement('td');
    if (className) {
      td.className = className;
    }
    td.textContent = text;
    return td;
  }

  /**
   * @param {PortRow[] | null} [rows]
   */
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
      setStatus('App bridge not available. Restart the application.', true);
      return;
    }
    setLoading(true);
    setStatus('Loading…', false);
    try {
      const res = await api.getPorts();
      if (!res || typeof res !== 'object') {
        setStatus('Unexpected response.', true);
        return;
      }
      if (res.ok && Array.isArray(res.data)) {
        allRows = res.data;
        setStatus('Ready.', false);
        renderFromCache();
      } else {
        const err = 'error' in res && res.error != null ? String(res.error) : 'Unknown error';
        setStatus(`Failed: ${err}`, true);
        allRows = [];
        renderFromCache([]);
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setStatus(`Failed: ${m}`, true);
      allRows = [];
      renderFromCache([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * @param {number} pid
   * @param {string} name
   */
  async function confirmKill(pid, name) {
    const line = `Kill process "${name}" (PID ${String(pid)})? This cannot be undone.`;
    // eslint-disable-next-line no-alert
    return window.confirm(line);
  }

  /**
   * @param {Event} ev
   */
  async function onTableClick(ev) {
    const t = ev.target;
    if (!(t instanceof HTMLButtonElement)) {
      return;
    }
    if (!t.classList.contains('btn-danger') || t.dataset.pid == null) {
      return;
    }
    const pid = Number.parseInt(t.dataset.pid, 10);
    if (Number.isNaN(pid)) {
      return;
    }
    const name = t.dataset.name != null && t.dataset.name !== '' ? t.dataset.name : 'unknown';
    const ok = await confirmKill(pid, name);
    if (!ok) {
      return;
    }
    const api = window.portKiller;
    if (!api) {
      setStatus('App bridge not available.', true);
      return;
    }
    setStatus(`Stopping PID ${String(pid)}…`, false);
    const result = await api.killProcess(pid);
    if (result && result.ok) {
      setStatus(`Stopped PID ${String(pid)}.`, false);
    } else {
      const err = result && 'error' in result && result.error != null ? String(result.error) : 'Failed';
      setStatus(`Could not stop PID ${String(pid)}: ${err}`, true);
    }
    await refresh();
  }

  if (rowsBody) {
    rowsBody.addEventListener('click', onTableClick);
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      void refresh();
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
