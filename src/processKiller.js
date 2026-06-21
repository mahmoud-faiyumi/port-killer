const { execFileWithRetry } = require('./winExec');

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

function extractCommandErrorText(err) {
  if (!err || typeof err !== 'object') {
    return String(err ?? 'Unknown error');
  }
  const stderr = typeof err.stderr === 'string' ? err.stderr.trim() : '';
  const message = err instanceof Error ? err.message : String(err);
  return stderr.length > 0 ? stderr : message;
}

function parseTaskkillOutcome(err) {
  const text = extractCommandErrorText(err);
  const lower = text.toLowerCase();
  if (
    lower.includes('not found') ||
    lower.includes('no running instance') ||
    lower.includes('no tasks are running')
  ) {
    return { ok: true, alreadyGone: true };
  }
  if (lower.includes('access is denied')) {
    return {
      ok: false,
      error:
        'Access denied. Run Port Killer as administrator, or stop the process from Task Manager.',
    };
  }
  if (lower.includes('critical system process') || lower.includes('protected process')) {
    return {
      ok: false,
      error: 'Windows blocked termination of a protected system process.',
    };
  }
  return { ok: false, error: text };
}

async function isProcessRunning(pid) {
  const pidString = String(pid);
  try {
    const { stdout } = await execFileWithRetry(
      'tasklist',
      ['/FI', `PID eq ${pidString}`, '/FO', 'CSV', '/NH'],
      { timeoutMs: 8000, retries: 0 },
    );
    const trimmed = String(stdout ?? '').trim();
    if (!trimmed || trimmed.startsWith('INFO:')) {
      return false;
    }
    return /^"[^"]+"\s*,\s*"\d+"/.test(trimmed);
  } catch {
    return false;
  }
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

  const stillRunningBefore = await isProcessRunning(pid);
  if (!stillRunningBefore) {
    return { ok: true, alreadyGone: true };
  }

  try {
    const args = ['/PID', pidString, '/F'];
    if (tree) {
      args.push('/T');
    }
    await execFileWithRetry('taskkill', args, { timeoutMs: 15000, retries: 0 });
  } catch (err) {
    const parsed = parseTaskkillOutcome(err);
    if (parsed.ok) {
      return parsed;
    }
    return parsed;
  }

  const stillRunningAfter = await isProcessRunning(pid);
  if (stillRunningAfter) {
    return {
      ok: false,
      error:
        'Process is still running. It may need administrator rights or may have restarted immediately.',
    };
  }

  return { ok: true };
}

module.exports = { killProcessByPid, isProcessRunning };
