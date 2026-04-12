import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initializeCronJobs } from "../cron";
import { handleTraccarWebhook } from "../traccar-webhook";
import { handleOwnTracksWebhook } from "../owntracks-webhook";
import { mobileRouter } from "../mobile-api";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Traccar webhook endpoint (GET request from Traccar Client app)
  app.get("/api/traccar", handleTraccarWebhook);
  
  // OwnTracks webhook endpoint (POST request from OwnTracks app)
  app.post("/api/owntracks/:username", handleOwnTracksWebhook);
  
  // File upload endpoint
  app.post("/api/upload", async (req, res) => {
    try {
      const multer = await import("multer");
      const { storagePut } = await import("../storage");
      
      // Configure multer for memory storage
      const upload = multer.default({ storage: multer.default.memoryStorage() });
      
      // Handle file upload
      upload.single('file')(req as any, res, async (err: any) => {
        if (err) {
          console.error('[Upload] Error:', err);
          return res.status(400).json({ error: 'فشل رفع الملف' });
        }
        
        const file = (req as any).file;
        if (!file) {
          return res.status(400).json({ error: 'لم يتم اختيار ملف' });
        }
        
        try {
          // Generate unique filename
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(7);
          const ext = file.originalname.split('.').pop();
          const filename = `uploads/${timestamp}-${randomStr}.${ext}`;
          
          // Upload to S3
          const result = await storagePut(
            filename,
            file.buffer,
            file.mimetype
          );
          
          console.log('[Upload] File uploaded successfully:', result.url);
          res.json({ url: result.url, key: result.key });
        } catch (uploadError) {
          console.error('[Upload] S3 upload error:', uploadError);
          res.status(500).json({ error: 'فشل رفع الملف إلى التخزين' });
        }
      });
    } catch (error) {
      console.error('[Upload] Unexpected error:', error);
      res.status(500).json({ error: 'حدث خطأ غير متوقع' });
    }
  });
  
  // Excel export endpoint
  app.get("/api/orders/export", async (req, res) => {
    try {
      const ExcelJS = await import("exceljs");
      const { getOrdersForExport } = await import("../db");
      
      // Parse query parameters
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const deliveryPersonIds = req.query.deliveryPersonIds 
        ? JSON.parse(req.query.deliveryPersonIds as string) 
        : undefined;
      const statuses = req.query.statuses 
        ? JSON.parse(req.query.statuses as string) 
        : undefined;
      const regionIds = req.query.regionIds 
        ? JSON.parse(req.query.regionIds as string) 
        : undefined;
      
      // Get orders
      const orders = await getOrdersForExport({
        startDate,
        endDate,
        deliveryPersonIds,
        statuses,
        regionIds,
      });
      
      // Create workbook
      const workbook = new ExcelJS.default.Workbook();
      const worksheet = workbook.addWorksheet("الطلبات");
      
      // Add headers
      worksheet.columns = [
        { header: "رقم الطلب", key: "id", width: 12 },
        { header: "اسم الزبون", key: "customerName", width: 20 },
        { header: "رقم الهاتف", key: "customerPhone", width: 15 },
        { header: "العنوان", key: "address", width: 30 },
        { header: "المنطقة", key: "regionName", width: 15 },
        { header: "المندوب", key: "deliveryPersonName", width: 20 },
        { header: "الحالة", key: "status", width: 12 },
        { header: "المبلغ", key: "totalAmount", width: 12 },
        { header: "تاريخ الإنشاء", key: "createdAt", width: 18 },
      ];
      
      // Add data
      orders.forEach(order => {
        worksheet.addRow({
          id: order.id,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          address: order.address,
          regionName: order.regionName || "-",
          deliveryPersonName: order.deliveryPersonName || "-",
          status: order.status,
          totalAmount: order.price,
          createdAt: new Date(order.createdAt).toLocaleString("ar-IQ"),
        });
      });
      
      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4CAF50" },
      };
      
      // Set response headers
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders_${Date.now()}.xlsx"`
      );
      
      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Excel export error:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });
  
  // Mobile REST API for native app
  app.use("/api/mobile", mobileRouter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Initialize cron jobs
    initializeCronJobs();
  });
}

startServer().catch(console.error);
