const chai = require('chai')

class InvalidWaitForUsageError extends Error {
  name = 'InvalidWaitForUsageError'
}

function isPromise(x) {
  return x instanceof Object && typeof x.then === 'function'
}

class WaitFor {
  constructor(options, buildAssertion) {
    this.options = options
    this.buildAssertion = buildAssertion
    if (options.outstandingCalls) {
      this.outstandingCall = new Error(
        'expected all waitFor() calls to be awaited, but this call was dangling'
      )
      options.outstandingCalls.add(this.outstandingCall)
    }
  }
  async poll() {
    const { timeout, retryInterval } = this.options
    let numAttempts = 0
    const startTime = new Date().getTime()
    const timeoutTime = startTime + timeout

    let lastAssertionObj

    // eslint-disable-next-line no-constant-condition
    while (true) {
      numAttempts++
      const thisAttemptStartTime = new Date().getTime()
      try {
        const assertion = await this.buildAssertion()
        if (assertion) {
          if (
            isPromise(lastAssertionObj) &&
            isPromise(assertion._obj) &&
            lastAssertionObj === assertion._obj
          ) {
            throw new InvalidWaitForUsageError(
              'waitFor() function may not return the same promise instance twice in a row'
            )
          }
          lastAssertionObj = assertion._obj
          await assertion._obj
        }
        return
      } catch (error) {
        if (error instanceof InvalidWaitForUsageError) {
          throw error
        }

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
    return this.poll()
      .finally(() => this._clearOutstanding())
      .then(onResolve, onReject)
  }
  _clearOutstanding() {
    const { outstandingCall } = this
    if (outstandingCall) {
      this.options.outstandingCalls?.delete(outstandingCall)
    }
  }
}

function bindWaitFor(options) {
  let outstandingCalls = undefined
  if (options.failOnDanglingCalls) {
    outstandingCalls = new Set()
    options.failOnDanglingCalls(() => {
      for (const call of outstandingCalls) {
        throw call
      }
    })
  }
  const finalOptions = { ...options, outstandingCalls }

  const bound = (value, ...args) => {
    if (typeof value !== 'function') {
      // construct an error here so that the call stack will point to
      // the waitFor() call, but use it to reject the WaitFor promise
      // instead of synchronously throwing it.  (Functions that sometimes
      // return a Promise and sometimes synchronously throw cause confusion)
      const error = new InvalidWaitForUsageError(
        'first argument to waitFor() must be a function'
      )
      return new WaitFor(finalOptions, () => {
        throw error
      })
    }
    return new WaitFor(finalOptions, () => {
      return chai.expect(value(), ...args)
    })
  }
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
      this._clearOutstanding()
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
          this._clearOutstanding()
          const gotten = new WaitFor(this.options, () => {
            const assertion = this.buildAssertion()
            return assertion[getterName]
          })
          gotten._clearOutstanding()
          function chainableMethodWrapper() {
            this._clearOutstanding()
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
          this._clearOutstanding()
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
