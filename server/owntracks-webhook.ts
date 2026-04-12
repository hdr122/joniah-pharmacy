/**
 * OwnTracks Webhook Handler
 * Receives GPS data from OwnTracks app in JSON format
 * 
 * OwnTracks sends location data as POST requests with JSON body:
 * {
 *   "_type": "location",
 *   "tid": "XX",  // Tracker ID (2 characters)
 *   "lat": 33.3152,
 *   "lon": 44.3661,
 *   "tst": 1638360000,  // Unix timestamp
 *   "acc": 10,  // Accuracy in meters
 *   "vel": 50,  // Velocity in km/h
 *   "cog": 180,  // Course over ground (heading) in degrees
 *   "batt": 85,  // Battery level (0-100)
 *   "t": "u"  // Trigger type: u=user, p=ping, b=beacon, c=circular region, etc.
 * }
 */

import { Request, Response } from "express";
import * as db from "./db";

export async function handleOwnTracksWebhook(req: Request, res: Response) {
  try {
    // Log all incoming requests
    console.log(`[OwnTracks] Incoming request from ${req.ip}`);
    console.log(`[OwnTracks] Body:`, req.body);
    
    const data = req.body;
    
    // Validate message type
    if (data._type !== "location") {
      console.log(`[OwnTracks] Ignoring non-location message: ${data._type}`);
      return res.status(200).json({ success: true }); // OwnTracks expects 200 even for ignored messages
    }
    
    // Extract device ID from URL path or query parameter
    // URL format: /api/owntracks/:username
    const username = req.params.username || req.query.id as string;
    
    if (!username) {
      return res.status(400).json({
        error: "Missing username in URL path or query parameter",
      });
    }
    
    // Validate required fields
    if (data.lat == null || data.lon == null) {
      return res.status(400).json({
        error: "Missing required fields: lat, lon",
      });
    }
    
    // Find delivery person by username
    const deliveryPerson = await db.getUserByUsername(username);
    
    if (!deliveryPerson || deliveryPerson.role !== "delivery") {
      return res.status(404).json({
        error: "Delivery person not found",
      });
    }
    
    // Save location to database
    await db.saveDeliveryLocation({
      deliveryPersonId: deliveryPerson.id,
      latitude: String(data.lat),
      longitude: String(data.lon),
      accuracy: data.acc != null ? String(data.acc) : undefined,
      speed: data.vel != null ? String(data.vel) : undefined,
      heading: data.cog != null ? String(data.cog) : undefined,
      battery: data.batt != null ? String(data.batt) : undefined,
    } as any);
    
    console.log(
      `[OwnTracks] ✅ Location saved successfully for ${username}: ` +
      `${data.lat}, ${data.lon}, speed: ${data.vel || 0} km/h, battery: ${data.batt || 'N/A'}%, ` +
      `heading: ${data.cog || 'N/A'}°, trigger: ${data.t || 'unknown'}`
    );
    
    // Return success response (OwnTracks expects empty array for success)
    return res.status(200).json([]);
  } catch (error) {
    console.error("[OwnTracks] Error processing webhook:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
