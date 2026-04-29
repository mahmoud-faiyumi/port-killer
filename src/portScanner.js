const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

function cleanProcessName(s, fallback) {
  const t = s.trim();
  if (!t) {
    return fallback ?? '—';
  }
  return t;
}

function parseAddressPort(addressWithPort) {
  if (!addressWithPort) {
    return null;
  }
  const s = addressWithPort.trim();
  if (s.startsWith('[')) {
    const close = s.indexOf(']:');
    if (close === -1) {
      return null;
    }
    const addr = s.slice(0, close + 1);
    const p = s.slice(close + 2);
    const port = Number(p);
    if (!Number.isFinite(port)) {
      return null;
    }
    return { address: addr, port };
  }
  const lastColon = s.lastIndexOf(':');
  if (lastColon === -1) {
    return null;
  }
  const addr = s.slice(0, lastColon);
  const p = s.slice(lastColon + 1);
  const port = Number(p);
  if (!Number.isFinite(port) || port < 0) {
    return null;
  }
  return { address: addr, port };
}

async function loadPidToNameMapWindows() {
  const map = new Map();
  try {
    const { stdout } = await execFileAsync('tasklist', ['/FO', 'CSV', '/NH'], {
      windowsHide: true,
      encoding: 'utf8',
    });
    for (const line of stdout.split(/\r?\n/)) {
      if (!line.trim() || line.startsWith('INFO:')) {
        continue;
      }
      const m = line.match(/^"([^"]+)"\s*,\s*"(\d+)"/);
      if (m) {
        const pid = Number(m[2]);
        if (Number.isInteger(pid)) {
          map.set(pid, m[1]);
        }
      }
    }
  } catch {
  }
  return map;
}

function rowFromNetstatParts(local, foreign, state, pid, pidToName) {
  const ap = parseAddressPort(local);
  if (!ap) {
    return null;
  }
  const name = pid === 0 ? 'System' : cleanProcessName(pidToName.get(pid) ?? '', '—');
  return {
    protocol: 'TCP',
    localAddress: ap.address,
    port: ap.port,
    pid,
    processName: name,
    state: state || 'UNKNOWN',
    foreignAddress: foreign,
  };
}

function parseWindowsNetstatTcpLine(line) {
  const trimmed = line.trim();
  if (!/^(?:TCPv6|TCP)\b/i.test(trimmed)) {
    return null;
  }
  const withoutProto = trimmed.replace(/^(?:TCPv6|TCP)\s+/i, '').trim();
  const parts = withoutProto.split(/\s+/);
  if (parts.length < 4) {
    return null;
  }
  const pid = Number(parts[parts.length - 1]);
  if (!Number.isInteger(pid) || pid < 0) {
    return null;
  }
  const state = parts[parts.length - 2] ?? '';
  const foreign = parts[parts.length - 3] ?? '';
  const local = parts.slice(0, -3).join(' ');
  if (!local) {
    return null;
  }
  return { local, foreign, state, pid };
}

function windowsTcpStateRank(state) {
  const s = String(state || '').toUpperCase();
  if (s === 'LISTENING') {
    return 100;
  }
  if (s === 'SYN_RECEIVED' || s === 'SYN_SENT') {
    return 60;
  }
  if (s === 'ESTABLISHED') {
    return 40;
  }
  if (s === 'CLOSE_WAIT' || s === 'FIN_WAIT_1' || s === 'FIN_WAIT_2' || s === 'TIME_WAIT') {
    return 20;
  }
  return 0;
}

function pickPreferredWindowsRow(existing, candidate) {
  const re = windowsTcpStateRank(existing.state);
  const rc = windowsTcpStateRank(candidate.state);
  if (rc > re) {
    return candidate;
  }
  if (re > rc) {
    return existing;
  }
  return existing;
}

function windowsListenAddressDisplayRank(addr) {
  const a = String(addr ?? '')
    .trim()
    .toLowerCase();
  if (a === '0.0.0.0') {
    return 400;
  }
  if (a === '[::]') {
    return 390;
  }
  if (a === '127.0.0.1') {
    return 300;
  }
  if (a === '[::1]') {
    return 290;
  }
  if (a.startsWith('[fe80:') || a.startsWith('fe80:')) {
    return 50;
  }
  return 100;
}

function pickDisplayLocalAddress(rows) {
  if (rows.length === 0) {
    return '—';
  }
  const listening = rows.filter((r) => String(r.state || '').toUpperCase() === 'LISTENING');
  const pool = listening.length > 0 ? listening : rows;
  let best = pool[0];
  let rank = windowsListenAddressDisplayRank(best.localAddress);
  for (let i = 1; i < pool.length; i += 1) {
    const r = pool[i];
    const rk = windowsListenAddressDisplayRank(r.localAddress);
    if (rk > rank || (rk === rank && String(r.localAddress) < String(best.localAddress))) {
      rank = rk;
      best = r;
    }
  }
  return best.localAddress;
}

function buildWindowsStateVariants(rows) {
  const seen = new Map();
  for (const r of rows) {
    const stateKey = String(r.state || '').toUpperCase();
    const foreign = r.foreignAddress == null || r.foreignAddress === '' ? '—' : String(r.foreignAddress);
    const dedupeKey = `${stateKey}\t${foreign}`;
    if (!seen.has(dedupeKey)) {
      seen.set(dedupeKey, {
        state: r.state || 'UNKNOWN',
        foreignAddress: foreign === '—' ? '' : foreign,
      });
    }
  }
  const list = Array.from(seen.values());
  list.sort((a, b) => windowsTcpStateRank(b.state) - windowsTcpStateRank(a.state));
  return list;
}

function collapseWindowsGroup(rows) {
  if (rows.length === 0) {
    return null;
  }
  let best = rows[0];
  for (let i = 1; i < rows.length; i += 1) {
    best = pickPreferredWindowsRow(best, rows[i]);
  }
  const variants = buildWindowsStateVariants(rows);
  const primaryAddress = pickDisplayLocalAddress(rows);
  if (variants.length <= 1) {
    return { ...best, localAddress: primaryAddress };
  }
  return {
    ...best,
    state: best.state,
    localAddress: primaryAddress,
    stateVariants: variants,
  };
}

async function getPortsWindows() {
  if (process.platform !== 'win32') {
    throw new Error('Port Killer supports Windows only.');
  }
  const pidToName = await loadPidToNameMapWindows();
  const { stdout } = await execFileAsync('netstat', ['-ano'], {
    windowsHide: true,
    encoding: 'utf8',
  });
  const lines = stdout.split(/\r?\n/);
  const groups = new Map();

  for (const line of lines) {
    const parsed = parseWindowsNetstatTcpLine(line);
    if (!parsed) {
      continue;
    }
    const { local, foreign, state, pid } = parsed;
    const row = rowFromNetstatParts(local, foreign, state, pid, pidToName);
    if (!row) {
      continue;
    }
    const key = `${row.port}|${row.pid}`;
    const list = groups.get(key);
    if (list) {
      list.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const out = [];
  for (const group of groups.values()) {
    const collapsed = collapseWindowsGroup(group);
    if (collapsed) {
      out.push(collapsed);
    }
  }

  return out.sort((a, b) => a.port - b.port);
}
async function getPorts() {
  return getPortsWindows();
}

module.exports = { getPorts };
