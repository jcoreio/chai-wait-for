const chai = require('chai')

class WaitFor {
  constructor(options, buildAssertion) {
    this.options = options
    this.buildAssertion = buildAssertion
  }
  async poll() {
    const { timeout, retryInterval } = this.options
    let numAttempts = 0
    const startTime = new Date().getTime()
    const timeoutTime = startTime + timeout

    // eslint-disable-next-line no-constant-condition
    while (true) {
      numAttempts++
      const thisAttemptStartTime = new Date().getTime()
      try {
        const assertion = await this.buildAssertion()
        if (assertion) await assertion._obj
        return
      } catch (error) {
        const now = new Date().getTime()
        if (now >= timeoutTime) {
          if (error instanceof Object && typeof error.message === 'string') {
            error.message += ` (timed out after ${timeout}ms, ${numAttempts} attempts)`
          }
          throw error
        }
        const nextTime = Math.min(
          timeoutTime,
          thisAttemptStartTime + retryInterval
        )
        if (nextTime > now) {
          await new Promise((resolve) => setTimeout(resolve, nextTime - now))
        }
      }
    }
  }
  then(onResolve, onReject) {
    return this.poll().then(onResolve, onReject)
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

  const isChainableMethod = (getterName) =>
    Object.prototype.hasOwnProperty.call(
      Assertion.prototype.__methods,
      getterName
    )

  getterNames.forEach((getterName) => {
    if (isChainableMethod(getterName)) {
      Object.defineProperty(WaitFor.prototype, getterName, {
        get() {
          const gotten = new WaitFor(this.options, () => {
            const assertion = this.buildAssertion()
            return assertion[getterName]
          })
          function chainableMethodWrapper() {
            return new WaitFor(this.options, () => {
              const assertion = this.buildAssertion()
              return assertion[getterName].apply(assertion, arguments)
            })
          }
          // Inherit all properties from the object by replacing the `Function` prototype
          var prototype = Object.create(gotten)
          // Restore the `call` and `apply` methods from `Function`
          prototype.call = Function.prototype.call
          prototype.apply = Function.prototype.apply
          Object.setPrototypeOf(chainableMethodWrapper, prototype)

          return chainableMethodWrapper
        },
        configurable: true,
      })
    } else {
      Object.defineProperty(WaitFor.prototype, getterName, {
        get() {
          return new WaitFor(this.options, () => {
            const assertion = this.buildAssertion()
            return assertion[getterName]
          })
        },
        configurable: true,
      })
    }
  })
}

module.exports.bindWaitFor = bindWaitFor
