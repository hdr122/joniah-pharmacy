import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import * as db from '../db';

export const locationRouter = router({
  /**
   * Record delivery person location update
   */
  recordLocation: publicProcedure
    .input(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy: z.number().optional(),
        altitude: z.number().optional(),
        heading: z.number().optional(),
        speed: z.number().optional(),
        timestamp: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new Error('Not authenticated');
        }

        // Save location to database
        const location = await db.saveDeliveryLocation({
          userId: ctx.user.id,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracy: input.accuracy,
          altitude: input.altitude,
          heading: input.heading,
          speed: input.speed,
          createdAt: new Date(input.timestamp || Date.now()),
        });

        // Broadcast to WebSocket clients in real-time
        if (global.websocketManager) {
          (global as any).websocketManager.broadcastLocationUpdate({
            userId: ctx.user.id,
            latitude: input.latitude,
            longitude: input.longitude,
            accuracy: input.accuracy,
            heading: input.heading,
            speed: input.speed,
            timestamp: input.timestamp || Date.now(),
          });
        }

        return { success: true, location };
      } catch (error) {
        console.error('[Location] Error recording location:', error);
        throw error;
      }
    }),

  /**
   * Get recent locations for a delivery person
   */
  getRecentLocations: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        withinMinutes: z.number().default(60),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new Error('Not authenticated');
        }

        // Check authorization: user can only get their own locations
        // Admins can get any location
        if (ctx.user.id !== input.userId && ctx.user.role !== 'admin') {
          throw new Error('Unauthorized');
        }

        const locations = await db.getDeliveryLocations(
          input.userId,
          input.limit,
          input.withinMinutes
        );

        return locations;
      } catch (error) {
        console.error('[Location] Error getting locations:', error);
        throw error;
      }
    }),

  /**
   * Get current location for a delivery person
   */
  getCurrentLocation: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new Error('Not authenticated');
        }

        const location = await db.getCurrentDeliveryLocation(input.userId);

        return location;
      } catch (error) {
        console.error('[Location] Error getting current location:', error);
        throw error;
      }
    }),

  /**
   * Get all active delivery person locations (for map)
   */
  getActiveLocations: publicProcedure
    .input(
      z.object({
        withinMinutes: z.number().default(15),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new Error('Not authenticated');
        }

        // Only admins can get all locations
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new Error('Unauthorized');
        }

        const locations = await db.getActiveDeliveryLocations(
          ctx.user.branchId,
          input.withinMinutes
        );

        return locations;
      } catch (error) {
        console.error('[Location] Error getting active locations:', error);
        throw error;
      }
    }),

  /**
   * Get delivery route for an order
   */
  getDeliveryRoute: publicProcedure
    .input(
      z.object({
        orderId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new Error('Not authenticated');
        }

        const route = await db.getDeliveryRoute(input.orderId);

        return route;
      } catch (error) {
        console.error('[Location] Error getting delivery route:', error);
        throw error;
      }
    }),
});
