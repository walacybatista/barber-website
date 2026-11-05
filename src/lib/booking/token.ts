import { createHash, randomBytes } from 'node:crypto';

/** RN07: 32 bytes aleatórios em base64url; só o SHA-256 (hex) é persistido. */
export function generateToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
