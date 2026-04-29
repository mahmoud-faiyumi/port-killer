const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const POSITIVE_INT_PATTERN = /^\d+$/;

function isSafePid(value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return false;
  }
  if (value <= 0) {
    return false;
  }
  return value < 2 ** 31;
}

async function killProcessByPid(pid, options = {}) {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'Port Killer supports Windows only.' };
  }
  if (!isSafePid(pid)) {
    return { ok: false, error: 'Invalid PID' };
  }
  const pidString = String(pid);
  if (!POSITIVE_INT_PATTERN.test(pidString)) {
    return { ok: false, error: 'Invalid PID' };
  }
  const tree = options && options.tree === true;

  try {
    const args = ['/PID', pidString, '/F'];
    if (tree) {
      args.push('/T');
    }
    await execFileAsync('taskkill', args, { windowsHide: true });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

module.exports = { killProcessByPid };
