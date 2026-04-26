const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const POSITIVE_INT_PATTERN = /^\d+$/;

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isSafePid(value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return false;
  }
  if (value <= 0) {
    return false;
  }
  return value < 2 ** 31;
}

/**
 * Terminates a process by PID. Platform-specific: taskkill (Windows) / kill (Unix).
 *
 * @param {number} pid
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function killProcessByPid(pid) {
  if (!isSafePid(pid)) {
    return { ok: false, error: 'Invalid PID' };
  }
  const pidString = String(pid);
  if (!POSITIVE_INT_PATTERN.test(pidString)) {
    return { ok: false, error: 'Invalid PID' };
  }

  try {
    if (process.platform === 'win32') {
      await execFileAsync('taskkill', ['/PID', pidString, '/F'], { windowsHide: true });
    } else {
      await execFileAsync('kill', ['-9', pidString]);
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

module.exports = { killProcessByPid };
