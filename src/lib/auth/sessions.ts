import { createHash, randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { adminUsers, sessions } from '../../db/schema.ts';

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Renovação deslizante: só grava no banco se passou mais de 1 dia desde a última extensão. */
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export function hashSessionId(id: string): string {
  return createHash('sha256').update(id).digest('hex');
}

export type AdminSession = {
  user: { id: number; username: string };
  expiresAt: Date;
  /** true quando a expiração foi estendida: o chamador deve reemitir o cookie. */
  renewed: boolean;
};

export async function createSession(
  db: Db,
  userId: number,
  now: Date = new Date(),
): Promise<{ sessionId: string; expiresAt: Date }> {
  const sessionId = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ idHash: hashSessionId(sessionId), userId, expiresAt });
  // Limpeza oportunista de sessões vencidas.
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  return { sessionId, expiresAt };
}

/** `null` se inexistente ou expirada. */
export async function validateSession(
  db: Db,
  sessionId: string | undefined,
  now: Date = new Date(),
): Promise<AdminSession | null> {
  if (!sessionId || sessionId.length > 200) return null;
  const idHash = hashSessionId(sessionId);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      userId: adminUsers.id,
      username: adminUsers.username,
    })
    .from(sessions)
    .innerJoin(adminUsers, eq(adminUsers.id, sessions.userId))
    .where(eq(sessions.idHash, idHash));
  if (!row) return null;
  if (row.expiresAt <= now) {
    await db.delete(sessions).where(eq(sessions.idHash, idHash));
    return null;
  }
  let expiresAt = row.expiresAt;
  let renewed = false;
  if (expiresAt.getTime() - now.getTime() < SESSION_TTL_MS - RENEW_AFTER_MS) {
    expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.idHash, idHash));
    renewed = true;
  }
  return { user: { id: row.userId, username: row.username }, expiresAt, renewed };
}

export async function deleteSession(db: Db, sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  await db.delete(sessions).where(eq(sessions.idHash, hashSessionId(sessionId)));
}

export function sessionCookieOptions(expires: Date, secure: boolean) {
  return { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', expires };
}
