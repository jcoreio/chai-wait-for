import chai from 'chai'
import chaiWaitFor, { bindWaitFor } from '../src'
chai.use(chaiWaitFor)

const waitFor = bindWaitFor({
  timeout: 5000,
  retryInterval: 500,
})

waitFor(5).to.equal(3)
