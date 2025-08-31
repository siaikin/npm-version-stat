export default defineAppConfig({
  head: {
    // eslint-disable-next-line node/prefer-global/process
    title: process.env.NUXT_PUBLIC_APP_NAME,
    viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  },
  // https://ui.nuxt.com/getting-started/theme#design-system
  ui: {
    colors: {
      primary: 'red',
    },
  },
  gueleton: {
    skeleton: { bone: { className: 'animate-pulse' }, container: { style: { zIndex: 60 } } },
  },
})
