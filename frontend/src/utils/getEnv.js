export default () => {
  const env = window.env || {}
  const baseURL = env.baseURL || location.host
  return { baseURL }
}
