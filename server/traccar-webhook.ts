/**
 * Traccar Webhook Handler
 * Receives GPS data from Traccar Client app in OsmAnd format
 * URL format: /api/traccar?id=USERNAME&lat=LAT&lon=LON&timestamp=UNIX&speed=SPEED&bearing=HEADING&accuracy=ACC&batt=BATTERY
 */

import { Request, Response } from "express";
import * as db from "./db";

export async function handleTraccarWebhook(req: Request, res: Response) {
  try {
    // Log all incoming requests
    console.log(`[Traccar] Incoming request from ${req.ip}`);
    console.log(`[Traccar] Query params:`, req.query);
    
    const { id, lat, lon, timestamp, speed, bearing, accuracy, batt } = req.query;

    // Validate required parameters
    if (!id || !lat || !lon) {
      return res.status(400).json({
        error: "Missing required parameters: id, lat, lon",
      });
    }

    // Find delivery person by username (device ID)
    const deliveryPerson = await db.getUserByUsername(id as string);

    if (!deliveryPerson || deliveryPerson.role !== "delivery") {
      return res.status(404).json({
        error: "Delivery person not found",
      });
    }

    // Save location to database
    await db.saveDeliveryLocation({
      deliveryPersonId: deliveryPerson.id,
      latitude: lat as string,
      longitude: lon as string,
      accuracy: accuracy as string | undefined,
      speed: speed as string | undefined,
      heading: bearing as string | undefined,
      battery: batt as string | undefined,
    } as any); // deviceId will be added after TypeScript regenerates types

    console.log(`[Traccar] ✅ Location saved successfully for ${id}: ${lat}, ${lon}, speed: ${speed}, battery: ${batt}%`);

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Location saved successfully",
    });
  } catch (error) {
    console.error("[Traccar] Error processing webhook:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
