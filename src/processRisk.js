const BLOCKED_PIDS = new Set([0, 4]);

const BLOCKED_PROCESS_NAMES = new Set([
  'system',
  'idle',
  'registry',
  'csrss.exe',
  'lsass.exe',
  'services.exe',
  'wininit.exe',
  'smss.exe',
]);

const CRITICAL_PROCESS_NAMES = new Set([
  'explorer.exe',
  'sqlservr.exe',
  'msmpeng.exe',
]);

function toProcessKey(processName) {
  return String(processName ?? '')
    .trim()
    .toLowerCase();
}

function getRiskLevel(pid, processName) {
  if (BLOCKED_PIDS.has(pid)) {
    return 'blocked';
  }
  const key = toProcessKey(processName);
  if (BLOCKED_PROCESS_NAMES.has(key)) {
    return 'blocked';
  }
  if (CRITICAL_PROCESS_NAMES.has(key)) {
    return 'critical';
  }
  return 'safe';
}

module.exports = { getRiskLevel };
