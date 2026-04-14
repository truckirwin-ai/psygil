/**
 * Windows Code Signing Script
 * Called by electron-builder for Authenticode signing.
 * Requires: WIN_CERT_PATH, WIN_CERT_PASSWORD env vars.
 *
 * For Azure Trusted Signing or DigiCert, replace with appropriate API call.
 */
const { execFileSync } = require('child_process')

exports.default = async function sign(configuration) {
  const { path: filePath } = configuration

  if (!process.env.WIN_CERT_PATH) {
    console.log('Skipping Windows signing — WIN_CERT_PATH not set')
    return
  }

  console.log(`Signing ${filePath}...`)

  try {
    execFileSync('signtool', [
      'sign',
      '/fd', 'SHA256',
      '/tr', 'http://timestamp.digicert.com',
      '/td', 'SHA256',
      '/f', process.env.WIN_CERT_PATH,
      '/p', process.env.WIN_CERT_PASSWORD || '',
      filePath,
    ])
    console.log('Signing complete.')
  } catch (err) {
    console.error('Signing failed:', err.message)
    throw err
  }
}
