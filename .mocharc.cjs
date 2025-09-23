/* eslint-env node, es2018 */
const base = require('@jcoreio/toolchain-mocha/.mocharc.cjs')
const { getSpecs } = require('@jcoreio/toolchain-mocha')
module.exports = {
  ...base,
  require: [
    ...base.require,
    // these need to be fully loaded before being require()d from CJS
    'chai',
    'chai-as-promised',
  ],
  spec: getSpecs(['test']),
}
