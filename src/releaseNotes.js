const https = require('node:https');

const GITHUB_OWNER = 'mahmoud-faiyumi';
const GITHUB_REPO = 'port-killer';

function normalizeTag(version) {
  const v = String(version ?? '').trim();
  if (!v) {
    return '';
  }
  return v.startsWith('v') ? v : `v${v}`;
}

/**
 * @param {string} version Semver or tag (with or without leading v)
 * @returns {Promise<{ ok: true, body: string } | { ok: false, error: string }>}
 */
function fetchReleaseNotesForVersion(version) {
  const tag = normalizeTag(version);
  if (!tag) {
    return Promise.resolve({ ok: false, error: 'Missing version.' });
  }
  const pathName = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${encodeURIComponent(tag)}`;
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: pathName,
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Port-Killer',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve({
              ok: false,
              error: `GitHub returned ${String(res.statusCode)} for ${tag}.`,
            });
            return;
          }
          try {
            const json = JSON.parse(raw);
            const body = typeof json.body === 'string' ? json.body : '';
            resolve({ ok: true, body });
          } catch (err) {
            resolve({
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        });
      },
    );
    req.on('error', (err) => {
      resolve({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    });
    req.setTimeout(15000, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.end();
  });
}

module.exports = { fetchReleaseNotesForVersion, normalizeTag };
