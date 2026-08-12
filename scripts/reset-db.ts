import {
  defaultDatabaseUrl,
  migrate,
  openDatabase,
} from "../src/infrastructure/db";
import { seed } from "../src/infrastructure/seed";

async function main(): Promise<void> {
  const databaseUrl = defaultDatabaseUrl();
  const db = openDatabase(databaseUrl);
  await migrate(db);
  await seed(db);
  await db.close();
  console.log(`Reset and seeded ${databaseUrl.replace(/\/\/.*@/, "//***@")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
