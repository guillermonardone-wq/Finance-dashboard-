import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Seed tracks with corner definitions
  const lagunaSeca = await prisma.track.upsert({
    where: { id: "track-laguna-seca" },
    update: {},
    create: {
      id: "track-laguna-seca",
      name: "WeatherTech Raceway Laguna Seca",
      location: "Monterey, CA",
      country: "US",
      lengthMeters: 3602,
      sfLineLat1: 36.5848,
      sfLineLng1: -121.7534,
      sfLineLat2: 36.5852,
      sfLineLng2: -121.7534,
      sfLineHeading: 135,
      source: "seed",
      corners: {
        create: [
          {
            number: 1,
            name: "Turn 1 (Andretti Hairpin)",
            entryLat: 36.5843,
            entryLng: -121.7525,
            apexLat: 36.5838,
            apexLng: -121.7521,
            exitLat: 36.5835,
            exitLng: -121.7518,
            type: "hairpin",
            direction: "right",
          },
          {
            number: 2,
            name: "Turn 2",
            entryLat: 36.5832,
            entryLng: -121.7510,
            apexLat: 36.5828,
            apexLng: -121.7505,
            exitLat: 36.5825,
            exitLng: -121.7500,
            type: "sweeper",
            direction: "left",
          },
          {
            number: 3,
            name: "Turn 3",
            entryLat: 36.5818,
            entryLng: -121.7488,
            apexLat: 36.5815,
            apexLng: -121.7483,
            exitLat: 36.5813,
            exitLng: -121.7478,
            type: "sweeper",
            direction: "right",
          },
          {
            number: 4,
            name: "Turn 4",
            entryLat: 36.5808,
            entryLng: -121.7465,
            apexLat: 36.5805,
            apexLng: -121.7460,
            exitLat: 36.5803,
            exitLng: -121.7455,
            type: "sweeper",
            direction: "left",
          },
          {
            number: 5,
            name: "Turn 5",
            entryLat: 36.5800,
            entryLng: -121.7445,
            apexLat: 36.5798,
            apexLng: -121.7440,
            exitLat: 36.5797,
            exitLng: -121.7435,
            type: "sweeper",
            direction: "right",
          },
          {
            number: 6,
            name: "Turn 6 (The Corkscrew Top)",
            entryLat: 36.5790,
            entryLng: -121.7530,
            apexLat: 36.5787,
            apexLng: -121.7533,
            exitLat: 36.5784,
            exitLng: -121.7535,
            type: "hairpin",
            direction: "left",
            notes:
              "Blind entry, steep downhill. Brake before the crest. Late apex.",
          },
          {
            number: 7,
            name: "Turn 7 (The Corkscrew Bottom)",
            entryLat: 36.5782,
            entryLng: -121.7537,
            apexLat: 36.5780,
            apexLng: -121.7540,
            exitLat: 36.5778,
            exitLng: -121.7542,
            type: "hairpin",
            direction: "right",
            notes: "Steep downhill exit. Get on throttle early for Rainey Curve.",
          },
          {
            number: 8,
            name: "Turn 8 (Rainey Curve)",
            entryLat: 36.5780,
            entryLng: -121.7548,
            apexLat: 36.5783,
            apexLng: -121.7555,
            exitLat: 36.5788,
            exitLng: -121.7560,
            type: "sweeper",
            direction: "left",
          },
          {
            number: 9,
            name: "Turn 9",
            entryLat: 36.5800,
            entryLng: -121.7565,
            apexLat: 36.5808,
            apexLng: -121.7562,
            exitLat: 36.5815,
            exitLng: -121.7558,
            type: "sweeper",
            direction: "right",
          },
          {
            number: 10,
            name: "Turn 10",
            entryLat: 36.5825,
            entryLng: -121.7550,
            apexLat: 36.5830,
            apexLng: -121.7545,
            exitLat: 36.5835,
            exitLng: -121.7540,
            type: "sweeper",
            direction: "left",
          },
          {
            number: 11,
            name: "Turn 11 (Final)",
            entryLat: 36.5840,
            entryLng: -121.7538,
            apexLat: 36.5843,
            apexLng: -121.7536,
            exitLat: 36.5846,
            exitLng: -121.7535,
            type: "sweeper",
            direction: "right",
          },
        ],
      },
    },
  });

  const watkins = await prisma.track.upsert({
    where: { id: "track-watkins-glen" },
    update: {},
    create: {
      id: "track-watkins-glen",
      name: "Watkins Glen International",
      location: "Watkins Glen, NY",
      country: "US",
      lengthMeters: 5472,
      sfLineLat1: 42.3369,
      sfLineLng1: -76.9275,
      sfLineLat2: 42.3373,
      sfLineLng2: -76.9275,
      sfLineHeading: 180,
      source: "seed",
      corners: {
        create: [
          {
            number: 1,
            name: "Turn 1",
            entryLat: 42.3365,
            entryLng: -76.9270,
            apexLat: 42.3360,
            apexLng: -76.9265,
            exitLat: 42.3355,
            exitLng: -76.9260,
            type: "sweeper",
            direction: "right",
          },
          {
            number: 2,
            name: "Turn 2 (The Esses Entry)",
            entryLat: 42.3345,
            entryLng: -76.9250,
            apexLat: 42.3340,
            apexLng: -76.9245,
            exitLat: 42.3335,
            exitLng: -76.9240,
            type: "chicane",
            direction: "left",
          },
        ],
      },
    },
  });

  // Seed a demo user
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@racingcoach.app" },
    update: {},
    create: {
      email: "demo@racingcoach.app",
      name: "Demo Driver",
    },
  });

  console.log("Seeded tracks:", lagunaSeca.name, watkins.name);
  console.log("Seeded user:", demoUser.email);
  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
