# chai-wait-for

[![CircleCI](https://circleci.com/gh/jcoreio/chai-wait-for.svg?style=svg)](https://circleci.com/gh/jcoreio/chai-wait-for)
[![Coverage Status](https://codecov.io/gh/jcoreio/chai-wait-for/branch/master/graph/badge.svg)](https://codecov.io/gh/jcoreio/chai-wait-for)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/chai-wait-for.svg)](https://badge.fury.io/js/chai-wait-for)

poll an assertion until it succeeds. Provides an especially clean syntax for working with some chai plugins like `chai-fs`, `chai-webdriverio-async` etc:

```js
await waitFor('#submittedMessage').to.have.text('Your changes have been saved!')
```

# Usage

```sh
npm install --save-dev chai-wait-for
```

```js
// First, use the plugin
const chai = require('chai')
const chaiWaitFor = require('chai-wait-for')
chai.use(chaiWaitFor)

// Then create your `waitFor` with default options:
const waitFor = chaiWaitFor.bindWaitFor({
  // If no assertion attempt succeeds before this time elapses (in milliseconds), the waitFor will fail.
  timeout: 5000,
  // If an assertion attempt fails, it will retry after this amount of time (in milliseconds)
  retryInterval: 100,
})

it('wait for something', async function () {
  this.timeout(10000)

  const myObj = { foo: 0 }

  setInterval(() => myObj.foo++, 1000)

  // Then use it just like you would expect():
  await waitFor(myObj).to.have.property('foo').that.equals(3)

  // You can also use a getter function:
  await waitFor(() => myObj.foo).to.equal(4)

  // If you need to override the defaults:
  waitFor.timeout(1000)(myObj).to.have.property('foo').that.equals(3)
  waitFor.retryInterval(500)(myObj).to.have.property('foo').that.equals(3)
})
```
