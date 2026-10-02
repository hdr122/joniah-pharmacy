// 🖼️ عرض صورة الطلب المرفقة — GET /api/order-image/:id
// يتحقّق من جلسة المستخدم وأن الطلب يخصّ فرعه، ثم يعيد الصورة بنوعها الصحيح.
import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";

export function registerOrderImageRoutes(app: Express) {
  app.get("/api/order-image/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });

      const user = await sdk.authenticateRequest(req as any).catch(() => null);
      if (!user) return res.status(401).json({ error: "unauthorized" });

      const img = await db.getOrderImage(id);
      if (!img) return res.status(404).json({ error: "not_found" });

      // التحقّق من الفرع: السوبر أدمن يرى الكل، وغيره فرعه فقط
      const isSuper = user.role === "superadmin" || user.role === "super_admin";
      if (!isSuper && (user as any).branchId && Number((user as any).branchId) !== img.branchId) {
        return res.status(403).json({ error: "forbidden" });
      }

      const buf = Buffer.from(img.data, "base64");
      res.setHeader("Content-Type", img.mimeType || "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.setHeader("Content-Length", String(buf.length));
      res.end(buf);
    } catch (e) {
      console.error("[OrderImage] error:", e);
      if (!res.headersSent) res.status(500).json({ error: "internal_error" });
    }
  });
}
