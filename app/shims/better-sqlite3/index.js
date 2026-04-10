// Re-export better-sqlite3-multiple-ciphers under the canonical
// `better-sqlite3` name so drizzle-orm/better-sqlite3 resolves it.
// See ../../scripts/electron-rebuild-clean.js and electron-builder.yml.
module.exports = require('better-sqlite3-multiple-ciphers')
