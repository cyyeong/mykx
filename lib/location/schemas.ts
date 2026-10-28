// Request bodies for the location routes (app/api/location). Strict: anything else is refused.
import { z } from "zod";

const iso = z.iso.datetime({ offset: true });

export const pointSchema = z.strictObject({
  at: iso,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(5000),
  speed: z.number().min(0).max(80).nullable().default(null),
  heading: z.number().min(0).max(360).nullable().default(null),
  activity: z.number().min(0).max(100).nullable().default(null),
  battery: z.number().int().min(0).max(100).nullable().default(null),
});

/** From a paired device (the simulator now, the phone app later): one kid's points, oldest first. */
export const locationPostBody = z.strictObject({
  kidId: z.guid(),
  points: z.array(pointSchema).min(1).max(50),
});

export const kidSettingsBody = z.strictObject({
  kidId: z.guid(),
  enabled: z.boolean().optional(),
  mode: z.enum(["live", "balanced", "saver", "school"]).optional(),
});

export const placeBody = z.strictObject({
  id: z.guid().optional(),
  name: z.string().trim().min(1).max(40),
  kind: z.enum(["home", "school", "other"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(50).max(300),
});

export const placeDeleteBody = z.strictObject({ id: z.guid() });

/** A teen pauses their own sharing for 30 minutes (founder, 28 Oct). */
export const pauseBody = z.strictObject({ minutes: z.literal(30) });
