// hack to prevent TS libcheck errors since we're testing compat with chai-webdriverio-async
// with a mock for webdriverio
declare module 'webdriverio' {
  export interface Browser {
    $: any
    $$: any
    waitUntil: any
  }
}
