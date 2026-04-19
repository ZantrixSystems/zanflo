const BOOTSTRAP_PASSWORD_RE = {
  upper: /[A-Z]/,
  number: /[0-9]/,
};

export function validateBootstrapPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!BOOTSTRAP_PASSWORD_RE.upper.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!BOOTSTRAP_PASSWORD_RE.number.test(password)) {
    return 'Password must include at least one number.';
  }
  return null;
}
