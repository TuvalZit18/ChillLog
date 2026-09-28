// What counts as valid input, defined once: the server enforces it on every request and the
// client forms use the same schemas to show problems before anything is sent.
// Dates typed by Summer are Israel local time ("2026-09-17" or "2026-09-17T10:00"); the server
// converts them to UTC.

import { z } from 'zod';

const name = z.string().trim().min(1, 'Enter a name.').max(80, 'Keep it under 80 characters.');
const id = z.coerce.number().int().positive();

export const localDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'Use a date like 2026-09-17, or 2026-09-17T10:00.');

export const unit = z.enum(['C', 'F']);
export const dateFormat = z.enum(['DD/MM', 'MM/DD']);

export const idParam = z.object({ id });

export const branchInput = z.object({ name });

export const fridgeInput = z.object({ branchId: id, name });

export const loggerInput = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,31}$/, 'Use the ID printed on the logger, e.g. TL-0417.'),
    unit: unit.optional(),
    dateFormat: dateFormat.optional(),
    /** Optionally place it straight away. */
    fridgeId: id.optional(),
    from: localDateTime.optional(),
  })
  .refine((v) => (v.fridgeId === undefined) === (v.from === undefined), {
    message: 'To place the logger, give both the fridge and the date.',
    path: ['from'],
  });

export const loggerSettingsInput = z
  .object({ unit: unit.optional(), dateFormat: dateFormat.optional() })
  .refine((v) => v.unit !== undefined || v.dateFormat !== undefined, {
    message: 'Change the unit, the date format, or both.',
  });

export const moveInput = z.object({ fridgeId: id, from: localDateTime });
