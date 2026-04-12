import { drizzle } from "drizzle-orm/mysql2";
import { users } from "./drizzle/schema";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

async function seed() {
  console.log("🌱 Starting seed...");

  // Check if admin already exists
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.username, "admin"))
    .limit(1);

  if (existingAdmin.length > 0) {
    console.log("✅ Admin user already exists");
  } else {
    // Create default admin user
    const passwordHash = await hash("admin51", 10);
    await db.insert(users).values({
      username: "admin",
      passwordHash,
      name: "المدير الرئيسي",
      role: "admin",
      loginMethod: "custom",
      isActive: true,
    });
    console.log("✅ Created default admin user (username: admin, password: admin51)");
  }

  console.log("🎉 Seed completed!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
