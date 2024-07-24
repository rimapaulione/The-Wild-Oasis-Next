import { z } from "zod";

export const reservationSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  numNights: z.number().positive(),
  cabinPrice: z.number().positive(),
  cabinId: z.number().gte(100).lte(200),
  guestId: z.number(),
  numGuests: z.number().gte(1).lte(10),
  observations: z.string().trim().min(0).max(1000).optional(),
  extrasPrice: z.number(0),
  totalPrice: z.number().positive(),
  isPaid: z.literal(false),
  hasBreakfast: z.boolean(),
  status: z.string().trim().min(1).max(100).optional(),
});
