// Uso: npm run db:seed  (idempotente: upsert por slug; horários são substituídos)
import { count, notInArray } from 'drizzle-orm';
import { createDb, loadDotEnv, readEnv } from '../src/db/client.ts';
import { barbers, openingHours, services } from '../src/db/schema.ts';
import { business } from '../src/data/business.ts';

loadDotEnv();
const url = readEnv('DATABASE_URL');
if (!url) throw new Error('DATABASE_URL não definida.');
const { db, sql: client } = createDb(url, { max: 1 });

try {
  await db.transaction(async (tx) => {
    for (const s of business.services) {
      const values = {
        slug: s.slug,
        name: s.name,
        description: s.description,
        durationMin: s.durationMin,
        priceCents: s.priceCents,
        active: true,
      };
      await tx
        .insert(services)
        .values(values)
        .onConflictDoUpdate({ target: services.slug, set: values });
    }
    for (const b of business.barbers) {
      const values = {
        slug: b.slug,
        name: b.name,
        bio: b.bio,
        specialties: [...b.specialties],
        photo: b.photo,
        active: true,
      };
      await tx
        .insert(barbers)
        .values(values)
        .onConflictDoUpdate({ target: barbers.slug, set: values });
    }
    // Itens removidos do business.ts ficam inativos (agendamentos antigos mantêm a referência).
    await tx
      .update(services)
      .set({ active: false })
      .where(
        notInArray(
          services.slug,
          business.services.map((s) => s.slug),
        ),
      );
    await tx
      .update(barbers)
      .set({ active: false })
      .where(
        notInArray(
          barbers.slug,
          business.barbers.map((b) => b.slug),
        ),
      );

    await tx.delete(openingHours);
    if (business.openingHours.length > 0) {
      await tx.insert(openingHours).values(
        business.openingHours.map((h) => ({
          weekday: h.weekday,
          openTime: h.open,
          closeTime: h.close,
        })),
      );
    }
  });

  const [s] = await db.select({ n: count() }).from(services);
  const [b] = await db.select({ n: count() }).from(barbers);
  const [h] = await db.select({ n: count() }).from(openingHours);
  console.log(`seed ok: services=${s.n} barbers=${b.n} opening_hours=${h.n}`);
} finally {
  await client.end();
}
