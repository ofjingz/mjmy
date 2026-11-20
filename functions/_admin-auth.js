export function isAdminPasswordValid(password, env) {
  return Boolean(password) &&
    (password === env.ADMIN_PASSWORD || password === env.ADMIN_PASSWORD_SECONDARY);
}
