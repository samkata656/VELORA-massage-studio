import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { procedures, rooms, therapists } from "./seed-data";
import { generateRota } from "../src/lib/scheduling/rota";
import { assignAt, type Interval } from "../src/lib/scheduling/availability";
import { addDays, keyToUtcDate, localToInstant, mondayOf, rangeKeys, todayKey, utcDateToKey } from "../src/lib/time";
import { BUFFER_MIN, ROTA_WEEKS_AHEAD } from "../src/lib/config";
import { bookingCode, hashPassword, randomToken, sha256 } from "../src/lib/crypto";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, options: "-c TimeZone=UTC" }) });

// Deterministic pseudo-random numbers so demo data is stable between runs.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pickOne = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const guests = [
  ["Nikol Georgieva", "nikol.g@example.com", "+359 88 555 0101"],
  ["Daniel Hristov", "daniel.h@example.com", "+359 89 555 0102"],
  ["Sofia Marinova", "sofia.m@example.com", "+359 87 555 0103"],
  ["Alex Turner", "alex.t@example.com", "+44 7700 900123"],
  ["Viktoria Angelova", "viki.a@example.com", "+359 88 555 0104"],
  ["Martin Stefanov", "martin.s@example.com", "+359 89 555 0105"],
  ["Lea Schneider", "lea.s@example.com", "+49 151 5550106"],
  ["Radoslav Iliev", "rado.i@example.com", "+359 87 555 0107"],
];

async function main() {
  console.log("Seeding VELORA…");

  for (const r of rooms) await db.room.upsert({ where: { id: r.id }, update: { name: r.name, sort: r.sort }, create: r });

  // No default passwords: when SEED_*_PASSWORD is empty a random one is generated and printed once,
  // so following the README never deploys a publicly known admin login.
  const passwordFor = (envKey: string, label: string) => {
    const fromEnv = process.env[envKey]?.trim();
    if (fromEnv) return fromEnv;
    const generated = randomToken(12);
    console.log(`${label} password (generated, shown once — set ${envKey} to choose your own): ${generated}`);
    return generated;
  };

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@velora-spa.bg";
  if (!(await db.user.findUnique({ where: { email: adminEmail } }))) {
    await db.user.create({
      data: { email: adminEmail, name: "VELORA Admin", role: "ADMIN", passwordHash: await hashPassword(passwordFor("SEED_ADMIN_PASSWORD", `Admin ${adminEmail}`)) },
    });
  } else {
    await db.user.update({ where: { email: adminEmail }, data: { role: "ADMIN" } });
  }
  const demoEmail = process.env.SEED_DEMO_EMAIL || "demo@velora-spa.bg";
  const existingDemo = await db.user.findUnique({ where: { email: demoEmail } });
  const demo = existingDemo ?? await db.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      name: "Demo Client",
      phone: "+359 88 000 1234",
      passwordHash: await hashPassword(passwordFor("SEED_DEMO_PASSWORD", `Demo client ${demoEmail}`)),
    },
  });

  if ((await db.procedure.count()) > 0) {
    console.log("Catalog already present — skipping procedures, therapists, rota and demo bookings.");
    return;
  }

  const createdProcedures = [];
  for (const [i, p] of procedures.entries()) {
    createdProcedures.push(
      await db.procedure.create({
        data: {
          slug: p.slug,
          nameEn: p.nameEn,
          nameBg: p.nameBg,
          summaryEn: p.summaryEn,
          summaryBg: p.summaryBg,
          therapistsRequired: p.therapistsRequired ?? 1,
          sort: i,
          variants: { create: p.variants.map((v) => ({ durationMin: v.durationMin, priceCents: v.price * 100 })) },
          article: { create: { ...p.article, source: "SEED" } },
        },
        include: { variants: true },
      }),
    );
  }

  const createdTherapists = [];
  for (const [i, t] of therapists.entries()) {
    createdTherapists.push(
      await db.therapist.create({
        data: {
          ...t,
          createdAt: new Date(Date.now() - (therapists.length - i) * 1000),
          skills: { create: createdProcedures.map((p) => ({ procedureId: p.id })) },
        },
      }),
    );
  }

  // Rota: last week (for history/stats) + the next 8 weeks.
  const today = todayKey();
  const firstMonday = addDays(mondayOf(today), -7);
  const weekStarts = Array.from({ length: ROTA_WEEKS_AHEAD + 1 }, (_, w) => addDays(firstMonday, w * 7));
  const rota = generateRota({
    therapistIds: createdTherapists.map((t) => t.id),
    weekStarts,
    existing: new Map(),
    absences: new Map(),
  });
  await db.shift.createMany({
    data: [...rota.shifts].flatMap(([therapistId, days]) => [...days].map((k) => ({ therapistId, date: keyToUtcDate(k), source: "AUTO" as const }))),
  });
  console.log(`Rota generated for ${weekStarts.length} weeks.`);

  // Demo bookings from last Monday to 10 days ahead.
  const shiftRows = await db.shift.findMany();
  const onShift = (k: string) => shiftRows.filter((s) => utcDateToKey(s.date) === k).map((s) => s.therapistId);
  let created = 0;
  for (const k of rangeKeys(firstMonday, addDays(today, 10))) {
    const tBusy = new Map<string, Interval[]>(onShift(k).map((id) => [id, []]));
    const rBusy = new Map<number, Interval[]>(rooms.map((r) => [r.id, []]));
    const attempts = 7 + Math.floor(rand() * 5);
    for (let i = 0; i < attempts; i++) {
      const proc = pickOne(createdProcedures);
      const variant = pickOne(proc.variants);
      const start = 600 + Math.floor(rand() * 32) * 15;
      const slot = assignAt(
        {
          durationMin: variant.durationMin,
          therapistsRequired: proc.therapistsRequired,
          therapists: [...tBusy].map(([id, busy]) => ({ id, busy })),
          rooms: [...rBusy].map(([id, busy]) => ({ id, busy })),
        },
        start,
      );
      if (!slot) continue;
      const block = { start: slot.start, end: slot.end + BUFFER_MIN };
      slot.therapistIds.forEach((id) => tBusy.get(id)!.push(block));
      slot.roomIds.forEach((id) => rBusy.get(id)!.push(block));
      const forDemo = rand() < 0.03;
      const [name, email, phone] = forDemo ? [demo.name, demo.email, demo.phone!] : pickOne(guests);
      const startsAt = localToInstant(k, slot.start);
      const isPast = startsAt < new Date();
      await db.appointment.create({
        data: {
          code: bookingCode(),
          userId: forDemo ? demo.id : null,
          guestName: name,
          guestEmail: email,
          guestPhone: phone,
          procedureId: proc.id,
          variantId: variant.id,
          startsAt,
          endsAt: localToInstant(k, slot.end),
          priceCents: variant.priceCents,
          status: isPast ? (rand() < 0.05 ? "NO_SHOW" : "COMPLETED") : "BOOKED",
          source: pickOne(["WEB", "WEB", "WEB", "ADMIN", "AI"] as const),
          cancelTokenHash: sha256(randomToken()),
          locale: rand() < 0.7 ? "bg" : "en",
          allocations: {
            create: slot.therapistIds.map((therapistId, j) => ({
              therapistId,
              roomId: slot.roomIds[j],
              startsAt,
              blockedUntil: localToInstant(k, block.end),
            })),
          },
        },
      });
      created++;
    }
  }
  console.log(`Created ${created} demo appointments.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
