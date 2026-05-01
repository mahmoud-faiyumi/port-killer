const fs = require('node:fs');
const path = require('node:path');

const SETTINGS_FILE_NAME = 'settings.json';

const DEFAULT_SETTINGS = Object.freeze({
  protectedPorts: [3000, 4200, 8080],
  killProcessTree: true,
  minimizeToTray: true,
  killDelaySeconds: 5,
  tableSortColumn: 'port',
  tableSortDirection: 'asc',
  pinnedPorts: [],
  theme: 'dark',
  dismissedReleaseNotesVersion: '',
});

function sanitizePortList(values) {
  if (!Array.isArray(values)) {
    return [...DEFAULT_SETTINGS.protectedPorts];
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
    protectedPorts: sanitizePortList(settings.protectedPorts),
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

module.exports = { createSettingsStore, DEFAULT_SETTINGS, sanitizeSettings };
