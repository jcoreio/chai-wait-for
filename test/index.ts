import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import chaiWaitFor, { bindWaitFor } from '../src/index'
import * as chai6 from 'chai'
// @ts-expect-error hard to get types to behave
import chai4 from 'chai4'
import sinon from 'sinon'
// @ts-expect-error types collide with chai >=5 but doesn't exist on chai 4
import chaiSubset from 'chai-subset'
import chaiAsPromised from 'chai-as-promised'
import chaiWebdriverioAsync from 'chai-webdriverio-async'

for (const chai of [chai6, chai4]) {
  describe(chai === chai6 ? 'chai@^6' : 'chai@^4', function () {
    const waitFor = bindWaitFor({ chai, retryInterval: 100, timeout: 1000 })

    let browser: any

    chai.use(chaiSubset)
    chai.use(chaiAsPromised)
    chai.use(
      chaiWebdriverioAsync({
        $: (selector: any) => browser.$(selector),
        $$: (selector: any) => browser.$$(selector),
        waitUntil: (...args: any[]) => browser.waitUntil(...args),
      })
    )
    chai.use(chaiWaitFor)
    // make sure using twice doesn't cause problems
    chai.use(chaiWaitFor)

    describe('waitFor', function () {
      let clock: sinon.SinonFakeTimers

      beforeEach(() => {
        clock = sinon.useFakeTimers()
      })
      afterEach(() => {
        clock.restore()
      })

      it('resolves when an assertion attempt passes within timeout', async function () {
        let i = 0
        const values = [
          { foo: 1, bar: 1 },
          { foo: 2, bar: 1 },
          { foo: 3, bar: 1 },
          { foo: 4, bar: 1 },
        ]
        await Promise.all([
          // @ts-expect-error using @types/chai-subset causes other problems
          waitFor(() => values[i++]).to.containSubset({ foo: 3 }),
          clock.tickAsync(501),
        ])
        expect(i).to.equal(3)
      })
      it('.to.include works', async function () {
        let i = 0
        const values = [
          { foo: 1, bar: 1 },
          { foo: 2, bar: 1 },
          { foo: 3, bar: 1 },
          { foo: 4, bar: 1 },
        ]
        await Promise.all([
          waitFor(() => values[i++]).to.include({ foo: 3 }),
          clock.tickAsync(501),
        ])
        expect(i).to.equal(3)
      })
      it('.to.include.all.keys works', async function () {
        let i = 0
        let values = {}
        await Promise.all([
          waitFor(
            () => (values = { ...values, [i++]: true })
          ).to.include.all.keys('1', '2', '3'),
          clock.tickAsync(1001),
        ])
        expect(i).to.equal(4)
      })
      it('works when an assertion takes longer than retryInterval', async function () {
        let i = 0
        await Promise.all([
          waitFor(async () => {
            await new Promise((resolve) => setTimeout(resolve, 200))
            if (i++ < 3) throw new Error('TEST')
          }),
          clock.tickAsync(1001),
        ])
        expect(i).to.equal(4)
      })

      it('works with chai-as-promised', async function () {
        let i = 0
        const values = [
          { foo: 1, bar: 1 },
          { foo: 2, bar: 1 },
          { foo: 3, bar: 1 },
          { foo: 4, bar: 1 },
        ]
        await Promise.all([
          // @ts-expect-error using @types/chai-subset causes other problems
          waitFor(async () => values[i++]).to.eventually.containSubset({
            foo: 3,
          }),
          clock.tickAsync(1001),
        ])
        expect(i).to.equal(3)
      })

      it('works with chai-webdriverio-async', async function () {
        let i = 0
        const values = ['foo', 'bar', 'baz', 'qux']
        browser = {
          $: async () => ({
            getText: async () => values[Math.min(values.length - 1, i++)],
          }),
          $$: async () => [await browser.$()],
        }
        await Promise.all([
          // @ts-expect-error not on promised language chain
          waitFor(() => '#foo').to.have.text('baz'),
          clock.tickAsync(501),
        ])
        expect(i).to.equal(3)
        await Promise.all([
          expect(
            waitFor(() => '#foo')
              // @ts-expect-error not on promised language chain
              .to.have.text('forgh')
              .then(() => {})
          ).to.be.rejectedWith(
            'Expected element <#foo> to have text "forgh", but only found: "qux" (timed out after 1000ms, 11 attempts)'
          ),
          clock.tickAsync(1001),
        ])
      })

      it(`throws on non-function assertion._obj`, async function () {
        const values = { foo: 1, bar: 1 }
        // @ts-expect-error function required
        await expect(waitFor(values)).to.be.rejectedWith(
          'first argument to waitFor() must be a function'
        )
      })

      it(`allows non-function assertion._obj when requireThunk: false`, async function () {
        const values = { foo: 1, bar: 1 }
        const waitFor = bindWaitFor({
          retryInterval: 100,
          timeout: 1000,
          requireThunk: false,
        })
        await Promise.all([
          // @ts-expect-error using @types/chai-subset causes other problems
          waitFor(values).to.containSubset({ bar: 2 }),
          (async () => {
            await clock.tickAsync(500)
            values.bar = 2
            await clock.tickAsync(1000)
          })(),
        ])
      })

      it(`throws when assertion._obj is same promise instance twice in a row`, async function () {
        const p = Promise.reject(new Error('foo'))
        await Promise.all([
          expect(waitFor(() => p)).to.be.rejectedWith(
            'waitFor() function may not return the same promise instance twice in a row'
          ),
          clock.tickAsync(1000),
        ])
      })

      it(`throws when outstanding calls are dangling and failOnDanglingCalls is provided`, async function () {
        let doAfterEach: () => void = () => {}
        const waitFor = bindWaitFor({
          retryInterval: 100,
          timeout: 1000,
          failOnDanglingCalls: (fn) => {
            doAfterEach = fn
          },
        })

        await waitFor(() => Promise.resolve([2]))
          .to.eventually.deep.equal([2])
          .and.contain(2)
        doAfterEach()

        waitFor(() => Promise.resolve())
        expect(() => doAfterEach()).to.throw(
          'expected all waitFor() calls to be awaited, but this call was dangling'
        )
      })

      it(`works with .have.property`, async function () {
        const values = { foo: 1, bar: 1 }
        setTimeout(() => (values.foo = 3), 300)
        await Promise.all([
          waitFor(() => values)
            .to.have.property('foo')
            .that.equals(3),
          clock.tickAsync(500),
        ])
      })

      it(`supports custom error message`, async function () {
        const values = { foo: 1, bar: 1 }
        await Promise.all([
          expect(
            waitFor(() => values, 'blah')
              // @ts-expect-error using @types/chai-subset causes other problems
              .to.containSubset({ foo: 3 })
              .then(() => {})
          ).to.be.rejectedWith(
            'blah: expected { foo: 1, bar: 1 } to contain subset { foo: 3 } (timed out after 1000ms, 11 attempts)'
          ),
          clock.tickAsync(1001),
        ])
      })

      it('rejects when no assertion attempt passes within timeout', async function () {
        let i = 0
        const values = [
          { foo: 1, bar: 1 },
          { foo: 2, bar: 1 },
          { foo: 3, bar: 1 },
          { foo: 4, bar: 1 },
        ]
        await Promise.all([
          expect(
            waitFor(() => values[Math.min(values.length - 1, i++)])
              // @ts-expect-error using @types/chai-subset causes other problems
              .to.containSubset({ foo: 5 })
              .then(() => {})
          ).to.be.rejectedWith(
            'expected { foo: 4, bar: 1 } to contain subset { foo: 5 } (timed out after 1000ms, 11 attempts)'
          ),
          clock.tickAsync(1001),
        ])
        expect(i).to.equal(11)
      })

      it('allows changing the timeout with .timeout()', async function () {
        let i = 0
        const values = [
          { foo: 1, bar: 1 },
          { foo: 2, bar: 1 },
          { foo: 3, bar: 1 },
          { foo: 4, bar: 1 },
        ]
        await Promise.all([
          expect(
            waitFor
              .timeout(500)(() => values[Math.min(values.length - 1, i++)])
              // @ts-expect-error using @types/chai-subset causes other problems
              .to.containSubset({ foo: 5 })
              .then(() => {})
          ).to.be.rejectedWith(
            'expected { foo: 4, bar: 1 } to contain subset { foo: 5 } (timed out after 500ms, 6 attempts)'
          ),
          clock.tickAsync(501),
        ])
        expect(i).to.equal(6)
      })

      it('allows changing the retry interval with .retryInterval()', async function () {
        let i = 0
        const values = [
          { foo: 1, bar: 1 },
          { foo: 2, bar: 1 },
          { foo: 3, bar: 1 },
          { foo: 4, bar: 1 },
        ]
        await Promise.all([
          expect(
            waitFor
              .retryInterval(200)(
                () => values[Math.min(values.length - 1, i++)]
              )
              // @ts-expect-error using @types/chai-subset causes other problems
              .to.containSubset({ foo: 5 })
              .then(() => {})
          ).to.be.rejectedWith(
            'expected { foo: 4, bar: 1 } to contain subset { foo: 5 } (timed out after 1000ms, 6 attempts)'
          ),
          clock.tickAsync(1001),
        ])
        expect(i).to.equal(6)
      })
    })
  })
}
