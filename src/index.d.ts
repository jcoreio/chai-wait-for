/// <reference types="chai" />

export interface BindWaitForOptions {
  timeout: number
  retryInterval: number
}

export interface BoundWaitFor {
  (val: any, message?: string): Chai.Assertion
  timeout(timeout: number): BoundWaitFor
  retryInterval(retryInterval: number): BoundWaitFor
}

export function bindWaitFor(options: BindWaitForOptions): BoundWaitFor

const chaiWaitFor: Chai.ChaiPlugin
export = chaiWaitFor
