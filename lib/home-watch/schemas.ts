// Request bodies for the Home watch routes (app/api/home). Strict: anything else is refused.
import { z } from "zod";

export const pairBody = z.strictObject({
  code: z.string().trim().min(8).max(12),
  name: z.string().trim().min(1).max(60),
});

export const newDeviceBody = z.strictObject({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(["home-link", "simulator"]).default("home-link"),
});

export const deviceDeleteBody = z.strictObject({ id: z.guid() });

export const camerasBody = z.strictObject({
  cameras: z
    .array(
      z.strictObject({
        key: z.string().trim().regex(/^[\w-]{1,40}$/),
        room: z.string().trim().min(1).max(40),
        enabled: z.boolean().default(true),
      }),
    )
    .max(10),
});

/** The `meta` part of a frames upload: which camera each file is from, and when. Files are `frame0`…`frame11`. */
export const framesMeta = z.strictObject({
  frames: z
    .array(
      z.strictObject({
        camera: z.string().regex(/^[\w-]{1,40}$/),
        at: z.iso.datetime({ offset: true }),
        /** 0 for a single picture; 0, 1, 2 within a burst of three. */
        burst: z.number().int().min(0).max(2).default(0),
      }),
    )
    .min(1)
    .max(12),
});

export const prefsBody = z.strictObject({
  homeArea: z.string().trim().min(2).max(60).optional(),
  radiusKm: z.union([z.literal(1), z.literal(3), z.literal(5)]).optional(),
  interests: z.array(z.string().trim().min(2).max(30)).max(12).optional(),
  camDays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  camFrom: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  camTo: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  pauseHours: z.union([z.literal(0), z.literal(1)]).optional(),
  descriptions: z.record(z.guid(), z.string().trim().max(120)).optional(),
});
