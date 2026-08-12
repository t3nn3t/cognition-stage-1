import { defaultDbPath, migrate, openDatabase } from "../src/infrastructure/db";
import { seed } from "../src/infrastructure/seed";

const dbPath = defaultDbPath();
const db = openDatabase(dbPath);
migrate(db);
seed(db);
db.close();
console.log(`Reset and seeded ${dbPath}`);
