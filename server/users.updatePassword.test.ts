import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("User Password Update", () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create a test delivery user with unique username
    const timestamp = Date.now();
    const result = await db.createUser({
      username: `test_pwd_${timestamp}`,
      password: "oldpassword123",
      name: "Test Password User",
      role: "delivery",
    });
    testUserId = result.id;
  });

  it("should update user password successfully", async () => {
    // Update password
    await db.updateUserPassword(testUserId, "newpassword456");

    // Get user and verify password changed
    const user = await db.getUserById(testUserId);
    expect(user).toBeDefined();
    expect(user?.passwordHash).toBeDefined();

    // Verify old password doesn't work
    const oldPasswordValid = await db.verifyPassword(user!.passwordHash!, "oldpassword123");
    expect(oldPasswordValid).toBe(false);

    // Verify new password works
    const newPasswordValid = await db.verifyPassword(user!.passwordHash!, "newpassword456");
    expect(newPasswordValid).toBe(true);
  });

  it("should hash the new password", async () => {
    const plainPassword = "testpassword789";
    await db.updateUserPassword(testUserId, plainPassword);

    const user = await db.getUserById(testUserId);
    expect(user?.passwordHash).toBeDefined();
    
    // Password hash should not equal plain password
    expect(user?.passwordHash).not.toBe(plainPassword);
    
    // But should verify correctly
    const isValid = await db.verifyPassword(user!.passwordHash!, plainPassword);
    expect(isValid).toBe(true);
  });
});
