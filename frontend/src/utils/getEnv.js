export default () => {
  const windowEnv = window.env || {}
  const baseURL = windowEnv.baseURL || location.host
  return { baseURL }
}
