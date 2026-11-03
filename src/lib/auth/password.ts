import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Generates a salted bcrypt hash for a plaintext password.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a candidate plaintext password with a stored bcrypt hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
