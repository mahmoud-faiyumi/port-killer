const fs = require('node:fs');
const path = require('node:path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }
  const localesDir = path.join(context.appOutDir, 'locales');
  if (!fs.existsSync(localesDir)) {
    return;
  }
  const keep = new Set(['en-US.pak']);
  for (const name of fs.readdirSync(localesDir)) {
    if (!name.endsWith('.pak')) {
      continue;
    }
    if (keep.has(name)) {
      continue;
    }
    try {
      fs.unlinkSync(path.join(localesDir, name));
    } catch {
    }
  }
};