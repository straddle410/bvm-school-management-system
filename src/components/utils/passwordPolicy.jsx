const POLICY_MESSAGE =
  'Password must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.';

export function validatePasswordPolicy(password) {
  if (!password) return { valid: false, message: POLICY_MESSAGE };

  const valid =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  return { valid, message: valid ? '' : POLICY_MESSAGE };
}

export const PASSWORD_POLICY_MESSAGE = POLICY_MESSAGE;