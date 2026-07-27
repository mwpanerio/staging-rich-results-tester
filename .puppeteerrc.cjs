const { join } = require('node:path');
const os = require('node:os');

/**
 * Keep Chrome in a stable user cache (not a sandbox temp dir).
 */
module.exports = {
  cacheDirectory: join(os.homedir(), '.cache', 'puppeteer'),
};
