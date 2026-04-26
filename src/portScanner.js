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

async function getPortsWindows() {
  const pidToName = await loadPidToNameMapWindows();
  const { stdout } = await execFileAsync('netstat', ['-ano'], {
    windowsHide: true,
    encoding: 'utf8',
  });
  const lines = stdout.split(/\r?\n/);
  const byKey = new Map();

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
    const key = `${row.port}|${row.localAddress}|${row.pid}|${row.state}`;
    if (!byKey.has(key)) {
      byKey.set(key, row);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.port - b.port);
}

function parseLsofListenLine(line) {
  const idx = line.indexOf(' TCP ');
  if (idx === -1) {
    return null;
  }
  const firstCol = line.slice(0, idx).trim().split(/\s+/);
  const processName = firstCol[0] ?? '—';
  const pid = Number(firstCol[1]);
  if (!Number.isInteger(pid)) {
    return null;
  }
  const tail = line.slice(idx + 1).trim();
  const m = /TCP (\S+)(?:->(\S+))? \((\w+)\)/.exec(tail);
  if (!m) {
    return null;
  }
  const localPart = m[1];
  const state = m[3] || 'UNKNOWN';
  const ap = parseAddressPort(localPart);
  if (!ap) {
    return null;
  }
  return {
    protocol: 'TCP',
    localAddress: ap.address,
    port: ap.port,
    pid,
    processName: cleanProcessName(processName, '—'),
    state: state.toUpperCase(),
    foreignAddress: m[2],
  };
}

async function getPortsMac() {
  const { stdout } = await execFileAsync(
    'lsof',
    ['-i', 'TCP', '-s', 'TCP:LISTEN', '-P', '-n'],
    { encoding: 'utf8' },
  );
  const lines = stdout.split(/\r?\n/);
  const out = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) {
      continue;
    }
    const row = parseLsofListenLine(line);
    if (row) {
      out.push(row);
    }
  }
  return dedupeAndSort(out);
}

function extractPidFromSs(processBlob) {
  const m = /pid=(\d+)/.exec(processBlob);
  if (!m) {
    return 0;
  }
  return Number(m[1]);
}

function extractProcessNameFromSs(processBlob) {
  const m = /users:\(\("([^"]+)"/.exec(processBlob);
  if (m) {
    return m[1];
  }
  return '—';
}

function parseSsLineWithProcess(line) {
  const t = line.trim();
  if (!t || t.startsWith('(')) {
    return null;
  }
  const usersIdx = t.indexOf(' users:(');
  if (usersIdx === -1) {
    return null;
  }
  const before = t.slice(0, usersIdx).trim();
  const processBlob = t.slice(usersIdx + 1);
  const beforeParts = before.split(/\s+/);
  if (beforeParts.length < 5) {
    return null;
  }
  const transport = (beforeParts[0] ?? '').toLowerCase();
  if (transport !== 'tcp' && transport !== 'udp') {
    return null;
  }
  const state = (beforeParts[1] ?? 'UNKNOWN').toUpperCase();
  const local = beforeParts[beforeParts.length - 2] ?? '';
  if (!local.includes(':')) {
    return null;
  }
  const ap = parseAddressPort(local.replace(/^\*:/, '0.0.0.0:'));
  if (!ap) {
    return null;
  }
  const pid = extractPidFromSs(processBlob);
  const name = extractProcessNameFromSs(processBlob);
  if (pid <= 0) {
    return null;
  }
  return {
    protocol: transport === 'udp' ? 'UDP' : 'TCP',
    localAddress: ap.address,
    port: ap.port,
    pid,
    processName: cleanProcessName(name, '—'),
    state,
  };
}

function parseSsOutput(stdout) {
  const lines = stdout.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const row = parseSsLineWithProcess(line);
    if (row) {
      out.push(row);
    }
  }
  return dedupeAndSort(out);
}

function dedupeAndSort(rows) {
  const key = (r) => `${r.protocol}|${r.port}|${r.localAddress}|${r.pid}|${r.state}`;
  const map = new Map();
  for (const r of rows) {
    if (!map.has(key(r))) {
      map.set(key(r), r);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.port - b.port);
}

async function getPortsLinux() {
  const { stdout } = await execFileAsync('ss', ['-H', '-tlnp'], { encoding: 'utf8' });
  return parseSsOutput(stdout);
}

async function getPorts() {
  if (process.platform === 'win32') {
    return getPortsWindows();
  }
  if (process.platform === 'darwin') {
    return getPortsMac();
  }
  if (process.platform === 'linux') {
    return getPortsLinux();
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}

module.exports = { getPorts };
