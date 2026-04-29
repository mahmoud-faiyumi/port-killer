const fs = require('node:fs');
const path = require('node:path');

const SETTINGS_FILE_NAME = 'settings.json';

const DEFAULT_SETTINGS = Object.freeze({
  protectedPorts: [3000, 4200, 8080],
  killProcessTree: true,
  minimizeToTray: true,
  killDelaySeconds: 5,
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

function sanitizeSettings(input) {
  const settings = input && typeof input === 'object' ? input : {};
  const next = {
    protectedPorts: sanitizePortList(settings.protectedPorts),
    killProcessTree: settings.killProcessTree !== false,
    minimizeToTray: settings.minimizeToTray !== false,
    killDelaySeconds: Number.isInteger(settings.killDelaySeconds)
      ? Math.max(0, Math.min(30, settings.killDelaySeconds))
      : DEFAULT_SETTINGS.killDelaySeconds,
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
