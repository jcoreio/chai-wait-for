/* eslint-disable @typescript-eslint/unified-signatures, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-function-type, prefer-spread, prefer-rest-params */
import * as defaultChai from 'chai'

class InvalidWaitForUsageError extends Error {
  name = 'InvalidWaitForUsageError'
}

function isPromise<T>(x: any): x is Promise<T> {
  return x instanceof Object && typeof x.then === 'function'
}

export interface BindWaitForOptions {
  chai?: Chai.ChaiStatic
  timeout: number
  retryInterval: number
  requireThunk?: boolean
  /**
   * Allows tests to assert that there are no unawaited waitFor()
   * calls after tests are done.
   *
   * Usage example:
   *
   *   import { afterEach } from 'mocha'
   *   import { bindWaitFor } from 'chai-wait-for'
   *
   *   const waitFor = bindWaitFor({
   *     timeout: 10000,
   *     retryInterval: 100,
   *     failOnDanglingCalls: afterEach,
   *   })
   */
  failOnDanglingCalls?: (fn: () => void) => unknown
}

export interface BoundWaitFor<Value = () => any> {
  <V extends Value>(
    val: V,
    message?: string
  ): V extends PromiseLike<any> ?
    {
      ERROR: 'assertion object may not be Promiselike, use waitFor(() => ...)'
    }
  : ResolvedPromisedAssertion
  timeout(timeout: number): BoundWaitFor
  retryInterval(retryInterval: number): BoundWaitFor
}

interface WaitForOptions extends BindWaitForOptions {
  outstandingCalls?: Set<Error>
}

class WaitFor {
  options: WaitForOptions
  buildAssertion: () => Chai.Assertion | ResolvedPromisedAssertion
  outstandingCall?: Error

  constructor(
    options: WaitForOptions,
    buildAssertion: () => Chai.Assertion | ResolvedPromisedAssertion
  ) {
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

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      numAttempts++
      const thisAttemptStartTime = new Date().getTime()
      try {
        const assertion = await this.buildAssertion()
        if (assertion) {
          const _obj = assertion._obj
          if (
            isPromise(lastAssertionObj) &&
            isPromise(_obj) &&
            lastAssertionObj === _obj
          ) {
            throw new InvalidWaitForUsageError(
              'waitFor() function may not return the same promise instance twice in a row'
            )
          }
          lastAssertionObj = _obj
          await _obj
        }
        return
      } catch (error) {
        if (error instanceof InvalidWaitForUsageError) {
          throw error
        }

        const now = new Date().getTime()
        if (now >= timeoutTime) {
          if (
            error instanceof Object &&
            'message' in error &&
            typeof error.message === 'string'
          ) {
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
  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.poll()
      .finally(() => this._clearOutstanding())
      .then(onfulfilled, onrejected)
  }
  _clearOutstanding() {
    const { outstandingCall } = this
    if (outstandingCall) {
      this.options.outstandingCalls?.delete(outstandingCall)
    }
  }
}

// @ts-expect-error type defs don't quite match
let lastUsedChai: Chai.ChaiStatic = defaultChai

export function bindWaitFor<Options extends BindWaitForOptions>(
  options: Options
): BoundWaitFor<Options extends { requireThunk: false } ? any : () => any> {
  const chai = options.chai || lastUsedChai

  let outstandingCalls: Set<Error> | undefined = undefined
  if (options.failOnDanglingCalls) {
    const localOutstandingCalls = (outstandingCalls = new Set())
    options.failOnDanglingCalls(() => {
      for (const call of localOutstandingCalls) {
        throw call
      }
    })
  }
  const finalOptions: WaitForOptions = { ...options, outstandingCalls }

  const bound: BoundWaitFor<
    Options extends { requireThunk: false } ? any : () => any
  > = (value, ...args) => {
    if (options.requireThunk !== false && typeof value !== 'function') {
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
      return chai.expect(typeof value === 'function' ? value() : value, ...args)
    }) as any
  }
  bound.timeout = (timeout) => bindWaitFor({ ...options, timeout })
  bound.retryInterval = (retryInterval) =>
    bindWaitFor({ ...options, retryInterval })

  return bound
}

export default function chaiWaitFor(chai: Chai.ChaiStatic) {
  lastUsedChai = chai
  const Assertion = chai.Assertion

  const propertyNames: (keyof Chai.Assertion)[] = Object.getOwnPropertyNames(
    Assertion.prototype
  ) as any

  const propertyDescs: {
    [K in keyof Chai.Assertion]?: PropertyDescriptor
  } = {}
  for (const name of propertyNames) {
    propertyDescs[name] = Object.getOwnPropertyDescriptor(
      Assertion.prototype,
      name
    )
  }

  // We need to be careful not to trigger any getters, thus `Object.getOwnPropertyDescriptor` usage.
  const methodNames = propertyNames.filter((name) => {
    // @ts-expect-error maybe some properties aren't defined
    return name !== 'assert' && typeof propertyDescs[name]?.value === 'function'
  })

  methodNames.forEach((methodName) => {
    // @ts-expect-error monkeypatching prototype
    WaitFor.prototype[methodName] = function () {
      this._clearOutstanding()
      return new WaitFor(this.options, () => {
        const assertion = this.buildAssertion()
        // @ts-expect-error it works
        return assertion[methodName].apply(assertion, arguments)
      })
    }
  })

  const getterNames = propertyNames.filter((name) => {
    // @ts-expect-error it works
    return name !== '_obj' && typeof propertyDescs[name]?.get === 'function'
  })

  const isChainableMethod = (getterName: string) =>
    Object.prototype.hasOwnProperty.call(
      // @ts-expect-error it works
      Assertion.prototype.__methods,
      getterName
    )

  getterNames.forEach((getterName) => {
    if (isChainableMethod(getterName)) {
      Object.defineProperty(WaitFor.prototype, getterName, {
        get(this: WaitFor) {
          this._clearOutstanding()
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          const self = this
          const gotten = new WaitFor(this.options, () => {
            const assertion = this.buildAssertion()
            // @ts-expect-error it works
            return assertion[getterName]
          })
          gotten._clearOutstanding()
          function chainableMethodWrapper() {
            self._clearOutstanding()
            return new WaitFor(self.options, () => {
              const assertion = self.buildAssertion()
              // @ts-expect-error it works
              return assertion[getterName].apply(assertion, arguments)
            })
          }
          // Inherit all properties from the object by replacing the `Function` prototype
          const prototype = Object.create(gotten)
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
chaiWaitFor.bindWaitFor = bindWaitFor

type ResolvedPromisedAssertion =
  // @ts-ignore
  unknown extends Chai.PromisedAssertion ? PromisedAssertion
  : // @ts-ignore
    Chai.PromisedAssertion

// The rest of these types are copied from chai-as-promised

// Eventually does not have .then(), but PromisedAssertion have.
interface Eventually
  extends PromisedLanguageChains,
    PromisedNumericComparison,
    PromisedTypeComparison {
  // From chai-as-promised
  become(expected: any): PromisedAssertion
  fulfilled: PromisedAssertion
  rejected: PromisedAssertion
  rejectedWith: PromisedThrow
  notify(fn: Function): PromisedAssertion

  // From chai
  not: PromisedAssertion
  deep: PromisedDeep
  ordered: PromisedOrdered
  nested: PromisedNested
  any: PromisedKeyFilter
  all: PromisedKeyFilter
  a: PromisedTypeComparison
  an: PromisedTypeComparison
  include: PromisedInclude
  contain: PromisedInclude
  ok: PromisedAssertion
  true: PromisedAssertion
  false: PromisedAssertion
  null: PromisedAssertion
  undefined: PromisedAssertion
  NaN: PromisedAssertion
  exist: PromisedAssertion
  empty: PromisedAssertion
  arguments: PromisedAssertion
  Arguments: PromisedAssertion
  equal: PromisedEqual
  equals: PromisedEqual
  eq: PromisedEqual
  eql: PromisedEqual
  eqls: PromisedEqual
  property: PromisedProperty
  ownProperty: PromisedOwnProperty
  haveOwnProperty: PromisedOwnProperty
  ownPropertyDescriptor: PromisedOwnPropertyDescriptor
  haveOwnPropertyDescriptor: PromisedOwnPropertyDescriptor
  length: PromisedLength
  lengthOf: PromisedLength
  match: PromisedMatch
  matches: PromisedMatch
  string(string: string, message?: string): PromisedAssertion
  keys: PromisedKeys
  key(string: string): PromisedAssertion
  throw: PromisedThrow
  throws: PromisedThrow
  Throw: PromisedThrow
  respondTo: PromisedRespondTo
  respondsTo: PromisedRespondTo
  itself: PromisedAssertion
  satisfy: PromisedSatisfy
  satisfies: PromisedSatisfy
  closeTo: PromisedCloseTo
  approximately: PromisedCloseTo
  members: PromisedMembers
  increase: PromisedPropertyChange
  increases: PromisedPropertyChange
  decrease: PromisedPropertyChange
  decreases: PromisedPropertyChange
  change: PromisedPropertyChange
  changes: PromisedPropertyChange
  extensible: PromisedAssertion
  sealed: PromisedAssertion
  frozen: PromisedAssertion
  oneOf(list: any[], message?: string): PromisedAssertion
}

interface PromisedAssertion extends Eventually, PromiseLike<any> {}

interface PromisedLanguageChains {
  eventually: Eventually

  // From chai
  to: PromisedAssertion
  be: PromisedAssertion
  been: PromisedAssertion
  is: PromisedAssertion
  that: PromisedAssertion
  which: PromisedAssertion
  and: PromisedAssertion
  has: PromisedAssertion
  have: PromisedAssertion
  with: PromisedAssertion
  at: PromisedAssertion
  of: PromisedAssertion
  same: PromisedAssertion
  but: PromisedAssertion
  does: PromisedAssertion
}

interface PromisedNumericComparison {
  above: PromisedNumberComparer
  gt: PromisedNumberComparer
  greaterThan: PromisedNumberComparer
  least: PromisedNumberComparer
  gte: PromisedNumberComparer
  below: PromisedNumberComparer
  lt: PromisedNumberComparer
  lessThan: PromisedNumberComparer
  most: PromisedNumberComparer
  lte: PromisedNumberComparer
  within(start: number, finish: number, message?: string): PromisedAssertion
}

interface PromisedNumberComparer {
  (value: number, message?: string): PromisedAssertion
}

interface PromisedTypeComparison {
  (type: string, message?: string): PromisedAssertion
  instanceof: PromisedInstanceOf
  instanceOf: PromisedInstanceOf
}

interface PromisedInstanceOf {
  (constructor: object, message?: string): PromisedAssertion
}

interface PromisedCloseTo {
  (expected: number, delta: number, message?: string): PromisedAssertion
}

interface PromisedNested {
  include: PromisedInclude
  property: PromisedProperty
  members: PromisedMembers
}

interface PromisedDeep {
  equal: PromisedEqual
  equals: PromisedEqual
  eq: PromisedEqual
  include: PromisedInclude
  property: PromisedProperty
  members: PromisedMembers
  ordered: PromisedOrdered
}

interface PromisedOrdered {
  members: PromisedMembers
}

interface PromisedKeyFilter {
  keys: PromisedKeys
}

interface PromisedEqual {
  (value: any, message?: string): PromisedAssertion
}

interface PromisedProperty {
  (name: string | symbol, value?: any, message?: string): PromisedAssertion
}

interface PromisedOwnProperty {
  (name: string | symbol, message?: string): PromisedAssertion
}

interface PromisedOwnPropertyDescriptor {
  (
    name: string | symbol,
    descriptor: PropertyDescriptor,
    message?: string
  ): PromisedAssertion
  (name: string | symbol, message?: string): PromisedAssertion
}

interface PromisedLength
  extends PromisedLanguageChains,
    PromisedNumericComparison {
  (length: number, message?: string): PromisedAssertion
}

interface PromisedInclude {
  (value: object, message?: string): PromisedAssertion
  (value: string, message?: string): PromisedAssertion
  (value: number, message?: string): PromisedAssertion
  keys: PromisedKeys
  deep: PromisedDeep
  ordered: PromisedOrdered
  members: PromisedMembers
  any: PromisedKeyFilter
  all: PromisedKeyFilter
}

interface PromisedMatch {
  (regexp: RegExp | string, message?: string): PromisedAssertion
}

interface PromisedKeys {
  (...keys: string[]): PromisedAssertion
  (keys: any[]): PromisedAssertion
  (keys: object): PromisedAssertion
}

interface PromisedThrow {
  (): PromisedAssertion
  (expected: string | RegExp, message?: string): PromisedAssertion
  (
    constructor: Error | Function,
    expected?: string | RegExp,
    message?: string
  ): PromisedAssertion
}

interface PromisedRespondTo {
  (method: string, message?: string): PromisedAssertion
}

interface PromisedSatisfy {
  (matcher: Function, message?: string): PromisedAssertion
}

interface PromisedMembers {
  (set: any[], message?: string): PromisedAssertion
}

interface PromisedPropertyChange {
  (object: object, property: string, message?: string): PromisedAssertion
}
