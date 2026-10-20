import { z } from "zod";

// Keep contact formats and bounds aligned with backend.app.validated.
export const leadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Введите имя")
    .max(100, "Не более 100 символов"),
  company: z
    .string()
    .trim()
    .min(2, "Укажите клинику или компанию")
    .max(160, "Не более 160 символов"),
  phone: z
    .string()
    .trim()
    .min(6, "Введите телефон или удобный контакт")
    .max(100, "Не более 100 символов")
    .refine(
      (value) =>
        (value.match(/\d/g)?.length ?? 0) >= 6 ||
        /^@[A-Za-z0-9_]{5,32}$/.test(value) ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
        /^(?:https:\/\/)?t\.me\/[A-Za-z0-9_]{5,32}$/.test(value),
      "Укажите телефон, email или Telegram-контакт",
    ),
  website: z
    .string()
    .trim()
    .max(300, "Не более 300 символов")
    .optional()
    .refine(
      (value) => !value || /^(?:https?:\/\/)?[^\s/]+\.[^\s]+$/.test(value),
      "Проверьте адрес сайта",
    ),
  message: z.string().trim().max(1000, "Не более 1000 символов").optional(),
  turnstileToken: z.string().optional(),
  consent: z.literal(true, { error: "Подтвердите согласие" }),
  website_check: z.string().max(0).optional(),
});
export type LeadFormData = z.infer<typeof leadSchema>;
