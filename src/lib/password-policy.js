const BOOTSTRAP_PASSWORD_RE = {
  upper: /[A-Z]/,
  lower: /[a-z]/,
  number: /[0-9]/,
  symbol: /[^A-Za-z0-9]/,
};

export function validateBootstrapPassword(password) {
  if (typeof password !== 'string' || password.length < 20) {
    return 'Password must be at least 20 characters long.';
  }
  if (!BOOTSTRAP_PASSWORD_RE.upper.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!BOOTSTRAP_PASSWORD_RE.lower.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!BOOTSTRAP_PASSWORD_RE.number.test(password)) {
    return 'Password must include at least one number.';
  }
  if (!BOOTSTRAP_PASSWORD_RE.symbol.test(password)) {
    return 'Password must include at least one symbol.';
  }
  return null;
}
