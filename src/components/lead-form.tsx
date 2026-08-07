"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { cloneElement } from "react";
import Script from "next/script";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { reachGoal } from "./analytics";

const schema = z.object({
  name: z.string().trim().min(2, "Введите имя"),
  company: z.string().trim().min(2, "Укажите клинику или компанию"),
  phone: z.string().trim().min(6, "Введите телефон или удобный контакт"),
  website: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        !value || /^(https?:\/\/)?[\wа-яё.-]+\.[a-zа-яё]{2,}/i.test(value),
      "Проверьте адрес сайта",
    ),
  message: z.string().trim().max(1000, "Не более 1000 символов").optional(),
  turnstileToken: z.string().optional(),
  consent: z.literal(true, { error: "Подтвердите согласие" }),
  website_check: z.string().max(0).optional(),
});

type FormData = z.infer<typeof schema>;

export function LeadForm({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [turnstileToken, setTurnstileToken] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const started = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { consent: false as true, website_check: "" },
  });

  useEffect(() => {
    (
      window as unknown as { onKlinikaTurnstile?: (token: string) => void }
    ).onKlinikaTurnstile = setTurnstileToken;
    const handler = () => {
      if (!started.current) {
        started.current = true;
        reachGoal("form_start");
      }
    };
    const form = document.querySelector("[data-lead-form]");
    form?.addEventListener("focusin", handler, { once: true });
    return () => {
      form?.removeEventListener("focusin", handler);
      delete (
        window as unknown as { onKlinikaTurnstile?: (token: string) => void }
      ).onKlinikaTurnstile;
    };
  }, []);

  async function onSubmit(values: FormData) {
    setStatus("idle");
    reachGoal("form_submit");
    let utm = {};
    try {
      utm = JSON.parse(sessionStorage.getItem("klinika_utm") || "{}");
    } catch {}
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          turnstileToken,
          page: window.location.pathname,
          referrer: document.referrer,
          utm,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok)
        throw new Error(payload.message || "Не удалось отправить заявку");
      setStatus("success");
      reachGoal("form_success");
      reset();
    } catch {
      setStatus("error");
      reachGoal("form_error");
    }
  }

  return (
    <form
      className={`lead-form ${compact ? "compact" : ""}`}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      data-lead-form
    >
      <div className="honeypot" aria-hidden="true">
        <label>
          Ваш сайт
          <input
            tabIndex={-1}
            autoComplete="off"
            {...register("website_check")}
          />
        </label>
      </div>
      <Field label="Имя" error={errors.name?.message}>
        <input autoComplete="name" {...register("name")} />
      </Field>
      <Field label="Компания / клиника" error={errors.company?.message}>
        <input autoComplete="organization" {...register("company")} />
      </Field>
      <Field label="Телефон или мессенджер" error={errors.phone?.message}>
        <input inputMode="tel" autoComplete="tel" {...register("phone")} />
      </Field>
      <Field label="Сайт" hint="если есть" error={errors.website?.message}>
        <input
          inputMode="url"
          placeholder="clinic.ru"
          {...register("website")}
        />
      </Field>
      {!compact && (
        <Field
          label="Что сейчас хотелось бы улучшить?"
          hint="необязательно"
          error={errors.message?.message}
        >
          <textarea rows={4} {...register("message")} />
        </Field>
      )}
      <label className="consent">
        <input type="checkbox" {...register("consent")} />
        <span>
          Согласен на обработку персональных данных согласно{" "}
          <a href="/soglasheniya">политике</a>.
        </span>
      </label>
      {errors.consent && (
        <p className="field-error" role="alert">
          {errors.consent.message}
        </p>
      )}
      {siteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
          />
          <div
            className="cf-turnstile"
            data-sitekey={siteKey}
            data-callback="onKlinikaTurnstile"
            data-theme="light"
          />
        </>
      )}
      <button
        className="button button-primary submit-button"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          <>
            <CircleNotch className="spinner" size={20} /> Отправляем…
          </>
        ) : (
          "Получить предварительный разбор"
        )}
      </button>
      <p className="form-note">
        Изучим открытые данные и свяжемся для уточнения задачи. Без обязательств
        на дальнейшее сотрудничество.
      </p>
      <div
        className={`form-status ${status}`}
        aria-live="polite"
        role={status === "error" ? "alert" : "status"}
      >
        {status === "success" && (
          <>
            <CheckCircle size={22} weight="fill" /> Заявка отправлена. Свяжемся
            после предварительного изучения данных.
          </>
        )}
        {status === "error" && (
          <>
            <WarningCircle size={22} weight="fill" /> Не получилось отправить
            заявку. Проверьте соединение и попробуйте ещё раз.
          </>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactElement<{
    id?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-zа-яё]+/gi, "-")}`;
  return (
    <label className="form-field" htmlFor={id}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {cloneElement(children, {
        id,
        "aria-invalid": !!error,
        "aria-describedby": error ? `${id}-error` : undefined,
      })}
      {error && (
        <em id={`${id}-error`} className="field-error">
          {error}
        </em>
      )}
    </label>
  );
}
