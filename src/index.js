const chai = require('chai')

class WaitFor {
  constructor(options, buildAssertion) {
    this.options = options
    this.buildAssertion = buildAssertion
  }

  then(onResolve, onReject) {
    const { timeout, retryInterval } = this.options
    let numAttempts = 0
    let startTime = new Date().getTime()
    let timeoutTime = startTime + timeout

    const poll = async () => {
      numAttempts++
      const thisAttemptStartTime = new Date().getTime()
      try {
        await this.buildAssertion()
      } catch (error) {
        const delay =
          Math.min(timeoutTime, thisAttemptStartTime + retryInterval) -
          new Date().getTime()

        if (delay <= 0) {
          error.message += ` (timed out after ${timeout}ms, ${numAttempts} attempts)`
          throw error
        }

        await new Promise((resolve) => setTimeout(resolve, delay))
        await poll()
      }
    }

    return poll().then(onResolve, onReject)
  }
}

function bindWaitFor(options) {
  const bound = (value, ...args) =>
    new WaitFor(options, () =>
      chai.expect(typeof value === 'function' ? value() : value, ...args)
    )
  bound.timeout = (timeout) => bindWaitFor({ ...options, timeout })
  bound.retryInterval = (retryInterval) =>
    bindWaitFor({ ...options, retryInterval })
  return bound
}

module.exports = (chai, utils) => {
  const Assertion = chai.Assertion

  const propertyNames = Object.getOwnPropertyNames(Assertion.prototype)

  const propertyDescs = {}
  for (const name of propertyNames) {
    propertyDescs[name] = Object.getOwnPropertyDescriptor(
      Assertion.prototype,
      name
    )
  }

  // We need to be careful not to trigger any getters, thus `Object.getOwnPropertyDescriptor` usage.
  const methodNames = propertyNames.filter((name) => {
    return name !== 'assert' && typeof propertyDescs[name].value === 'function'
  })

  methodNames.forEach((methodName) => {
    WaitFor.prototype[methodName] = function () {
      return new WaitFor(this.options, () => {
        const assertion = this.buildAssertion()
        return assertion[methodName].apply(assertion, arguments)
      })
    }
  })

  const getterNames = propertyNames.filter((name) => {
    return name !== '_obj' && typeof propertyDescs[name].get === 'function'
  })

  getterNames.forEach((getterName) => {
    Object.defineProperty(WaitFor.prototype, getterName, {
      get() {
        return new WaitFor(this.options, () => {
          const assertion = this.buildAssertion()
          return assertion[getterName]
        })
      },
      configurable: true,
    })
  })
}

module.exports.bindWaitFor = bindWaitFor
