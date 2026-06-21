const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRIES = 1;
const RETRY_DELAY_MS = 250;

/**
 * @param {string} file
 * @param {string[]} args
 * @param {{ timeoutMs?: number, encoding?: string, windowsHide?: boolean }} [options]
 */
async function execFileWithTimeout(file, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await execFileAsync(file, args, {
      windowsHide: true,
      encoding: 'utf8',
      signal: controller.signal,
      ...options,
    });
  } catch (err) {
    if (err && (err.name === 'AbortError' || err.code === 'ABORT_ERR')) {
      throw new Error(`Command timed out after ${String(timeoutMs)}ms: ${file}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} file
 * @param {string[]} args
 * @param {{ timeoutMs?: number, retries?: number }} [options]
 */
async function execFileWithRetry(file, args, options = {}) {
  const retries = options.retries ?? DEFAULT_RETRIES;
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await execFileWithTimeout(file, args, options);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => {
          setTimeout(resolve, RETRY_DELAY_MS);
        });
      }
    }
  }
  throw lastError;
}

module.exports = { execFileWithTimeout, execFileWithRetry, DEFAULT_TIMEOUT_MS };
