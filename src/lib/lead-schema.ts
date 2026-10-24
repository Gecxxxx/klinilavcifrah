import {
  object,
  string,
  optional,
  literal,
  trim,
  minLength,
  maxLength,
  refine,
} from "zod/mini";
import type { infer as Infer } from "zod/mini";

// Functional imports keep the client bundle small; rules match backend.app.validated.
const bounded = (minimum: number, maximum: number, message: string) =>
  string({ error: message }).check(
    trim(),
    minLength(minimum, message),
    maxLength(maximum, `Не более ${maximum} символов`),
  );
export const leadSchema = object({
  name: bounded(2, 100, "Введите имя"),
  company: bounded(2, 160, "Укажите клинику или компанию"),
  phone: bounded(6, 100, "Введите телефон или удобный контакт").check(
    refine(
      (value) =>
        (value.match(/\d/g)?.length ?? 0) >= 6 ||
        /^@[A-Za-z0-9_]{5,32}$/.test(value) ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
        /^(?:https:\/\/)?t\.me\/[A-Za-z0-9_]{5,32}$/.test(value),
      "Укажите телефон, email или Telegram-контакт",
    ),
  ),
  website: optional(bounded(0, 300, "Проверьте адрес сайта")).check(
    refine(
      (value) => !value || /^(?:https?:\/\/)?[^\s/]+\.[^\s]+$/.test(value),
      "Проверьте адрес сайта",
    ),
  ),
  message: optional(bounded(0, 1000, "Проверьте описание задачи")),
  turnstileToken: optional(string()),
  consent: literal(true, { error: "Подтвердите согласие" }),
  website_check: optional(string().check(maxLength(0))),
});
export type LeadFormData = Infer<typeof leadSchema>;
