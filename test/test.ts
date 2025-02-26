import chai from 'chai'
import chaiWaitFor, { bindWaitFor } from '../src'
chai.use(chaiWaitFor)

await bindWaitFor({
  timeout: 5000,
  retryInterval: 500,
  requireThunk: false,
})(5).to.equal(3)

await bindWaitFor({
  timeout: 5000,
  retryInterval: 500,
})(
  // @ts-expect-error must be a function
  5
).to.equal(3)

await bindWaitFor({
  timeout: 5000,
  retryInterval: 500,
})(() => 5).to.equal(3)
