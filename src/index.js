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
        const assertion = await this.buildAssertion()
        if (assertion) await assertion._obj
      } catch (error) {
        const now = new Date().getTime()

        if (now >= timeoutTime) {
          error.message += ` (timed out after ${timeout}ms, ${numAttempts} attempts)`
          throw error
        }
        const nextTime = Math.min(
          timeoutTime,
          thisAttemptStartTime + retryInterval
        )

        if (nextTime > now)
          await new Promise((resolve) => setTimeout(resolve, nextTime - now))
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

  const isChainableMethod = (getterName) =>
    Object.prototype.hasOwnProperty.call(
      Assertion.prototype.__methods,
      getterName
    )

  getterNames.forEach((getterName) => {
    if (isChainableMethod(getterName)) {
      Object.defineProperty(WaitFor.prototype, getterName, {
        get() {
          const obj = new WaitFor(this.options, () => {
            const assertion = this.buildAssertion()
            return assertion[getterName]
          })
          function chainable() {
            return new WaitFor(this.options, () => {
              const assertion = this.buildAssertion()
              return assertion[getterName].apply(assertion, arguments)
            })
          }
          for (const methodName of methodNames) {
            chainable[methodName] = obj[methodName].bind(obj)
          }
          for (const getterName of getterNames) {
            Object.defineProperty(chainable, getterName, {
              get() {
                return obj[getterName]
              },
              configurable: true,
            })
          }
          return chainable
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
