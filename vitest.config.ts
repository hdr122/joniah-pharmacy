import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // كل الاختبارات تشترك في قاعدة بيانات MariaDB واحدة، وبعضها يُعيد بناء جداول
    // (اختبار الترحيل يُسقط جداول واتساب). التشغيل المتوازي للملفات يسبّب تسابقاً
    // يُفشل اختبارات تقرأ بينما يُسقط آخر الجدول. نُشغّل الملفات تسلسلياً للحتمية.
    fileParallelism: false,
  },
});
