const fs = require('node:fs');
const path = require('node:path');

const SETTINGS_FILE_NAME = 'settings.json';

function portRange(lo, hi) {
  const out = [];
  for (let p = lo; p <= hi; p += 1) {
    out.push(p);
  }
  return out;
}

const DEFAULT_DEV_PORTS = Object.freeze([
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

const DEFAULT_SETTINGS = Object.freeze({
  protectedPorts: [3000, 4200, 8080],
  devPorts: [...DEFAULT_DEV_PORTS],
  devPortsOnly: true,
  killProcessTree: true,
  minimizeToTray: true,
  killDelaySeconds: 5,
  tableSortColumn: 'port',
  tableSortDirection: 'asc',
  pinnedPorts: [],
  theme: 'dark',
  dismissedReleaseNotesVersion: '',
});

function sanitizePortList(values, fallback) {
  const fallbackList = Array.isArray(fallback) ? fallback : [...DEFAULT_SETTINGS.protectedPorts];
  if (!Array.isArray(values)) {
    return [...fallbackList];
  }
  const set = new Set();
  for (const value of values) {
    const n = Number.parseInt(String(value), 10);
    if (Number.isInteger(n) && n >= 1 && n <= 65535) {
      set.add(n);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

const SORT_COLUMNS = new Set(['port', 'pid', 'process', 'state']);
const SORT_DIRECTIONS = new Set(['asc', 'desc']);
const THEMES = new Set(['dark', 'light', 'system']);

function sanitizePinnedPorts(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  const set = new Set();
  for (const value of values) {
    const n = Number.parseInt(String(value), 10);
    if (Number.isInteger(n) && n >= 1 && n <= 65535) {
      set.add(n);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

function sanitizeSettings(input) {
  const settings = input && typeof input === 'object' ? input : {};
  const sortCol = SORT_COLUMNS.has(settings.tableSortColumn) ? settings.tableSortColumn : DEFAULT_SETTINGS.tableSortColumn;
  const sortDir = SORT_DIRECTIONS.has(settings.tableSortDirection)
    ? settings.tableSortDirection
    : DEFAULT_SETTINGS.tableSortDirection;
  const theme = THEMES.has(settings.theme) ? settings.theme : DEFAULT_SETTINGS.theme;
  const dismissed =
    typeof settings.dismissedReleaseNotesVersion === 'string'
      ? settings.dismissedReleaseNotesVersion
      : DEFAULT_SETTINGS.dismissedReleaseNotesVersion;
  const next = {
    protectedPorts: sanitizePortList(settings.protectedPorts, DEFAULT_SETTINGS.protectedPorts),
    devPorts: sanitizePortList(settings.devPorts, DEFAULT_DEV_PORTS),
    devPortsOnly: settings.devPortsOnly !== false,
    killProcessTree: settings.killProcessTree !== false,
    minimizeToTray: settings.minimizeToTray !== false,
    killDelaySeconds: Number.isInteger(settings.killDelaySeconds)
      ? Math.max(0, Math.min(30, settings.killDelaySeconds))
      : DEFAULT_SETTINGS.killDelaySeconds,
    tableSortColumn: sortCol,
    tableSortDirection: sortDir,
    pinnedPorts: sanitizePinnedPorts(settings.pinnedPorts),
    theme,
    dismissedReleaseNotesVersion: dismissed,
  };
  return next;
}

function createSettingsStore(app) {
  const settingsPath = path.join(app.getPath('userData'), SETTINGS_FILE_NAME);

  function read() {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      return sanitizeSettings(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function write(partial) {
    const merged = sanitizeSettings({ ...read(), ...(partial || {}) });
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }

  return { read, write, path: settingsPath };
}

module.exports = { createSettingsStore, DEFAULT_SETTINGS, DEFAULT_DEV_PORTS, sanitizeSettings };
