/* eslint-env node, es2018 */
module.exports = {
  extends: [require.resolve('@jcoreio/toolchain/eslintConfig.cjs')],
  env: {
    es6: true,
    commonjs: true,
    'shared-node-browser': true,
  },
}
