/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/ban-types */
/// <reference types="chai" />

export interface BindWaitForOptions {
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
  (val: Value, message?: string): ResolvedPromisedAssertion
  timeout(timeout: number): BoundWaitFor
  retryInterval(retryInterval: number): BoundWaitFor
}

export function bindWaitFor<Options extends BindWaitForOptions>(
  options: Options
): BoundWaitFor<Options extends { requireThunk: false } ? any : () => any>

declare const chaiWaitFor: Chai.ChaiPlugin
export default chaiWaitFor

type ResolvedPromisedAssertion =
  // @ts-ignore
  unknown extends Chai.PromisedAssertion
    ? PromisedAssertion
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
  (constructor: Object, message?: string): PromisedAssertion
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
  (value: Object, message?: string): PromisedAssertion
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
  (keys: Object): PromisedAssertion
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
  (object: Object, property: string, message?: string): PromisedAssertion
}
