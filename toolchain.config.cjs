/* eslint-env node, es2018 */
if (!process.version.startsWith('v24.')) {
  throw new Error(`Must use Node ^24 (current version: ${process.version})`)
}
module.exports = {
  cjsBabelEnv: { targets: { node: 16 } },
  esmBabelEnv: { targets: { node: 20 } },
  // outputEsm: false,
}
