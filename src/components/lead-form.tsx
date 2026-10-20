"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Script from "next/script";
import { useForm } from "react-hook-form";
import { reachGoal } from "@/lib/analytics";
import { prepareLeadRequest, acknowledgeLead } from "@/lib/lead-request";
import { browserAttribution } from "@/lib/lead-attribution";
import { leadSchema, type LeadFormData } from "@/lib/lead-schema";

type Turnstile = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
};
function challenge() {
  return (window as unknown as { turnstile?: Turnstile }).turnstile;
}

export function LeadForm({ compact = false }: { compact?: boolean }) {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [leadId, setLeadId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const started = useRef(false);
  const inFlight = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const formId = useId();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: { consent: false as true, website_check: "" },
  });
  const goal = (name: string, extra: Record<string, string> = {}) => {
    const source = browserAttribution();
    reachGoal(name, {
      page: source.page,
      location: source.ctaLocation,
      direction: source.direction,
      product: source.product,
      ...extra,
    });
  };
  const mountChallenge = useCallback(() => {
    if (
      !siteKey ||
      !widget.current ||
      widgetId.current !== undefined ||
      !challenge()
    )
      return;
    widgetId.current = challenge()!.render(widget.current, {
      sitekey: siteKey,
      theme: "light",
      size: "compact",
      callback: setTurnstileToken,
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => {
        setTurnstileToken("");
        return true;
      },
    });
  }, [siteKey]);
  useEffect(() => {
    mountChallenge();
    return () => {
      if (widgetId.current !== undefined) {
        try {
          challenge()?.remove(widgetId.current);
        } catch {}
        widgetId.current = undefined;
      }
    };
  }, [mountChallenge]);
  useEffect(() => {
    if (status !== "idle") statusRef.current?.focus();
  }, [status]);
  function resetChallenge() {
    setTurnstileToken("");
    if (widgetId.current !== undefined) {
      try {
        challenge()?.reset(widgetId.current);
      } catch {}
    }
  }

  async function onSubmit(values: LeadFormData) {
    if (inFlight.current) return;
    if (siteKey && !turnstileToken) {
      setErrorMessage(
        "Дождитесь проверки защиты формы. Если она не загружается, обновите страницу и попробуйте снова.",
      );
      setStatus("error");
      goal("form_error", { reason: "captcha" });
      return;
    }
    inFlight.current = true;
    setSending(true);
    setStatus("idle");
    setErrorMessage("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let storage: Storage | undefined;
    try {
      storage = window.sessionStorage;
    } catch {}
    let reason = "network";
    try {
      const body = await prepareLeadRequest(
        values,
        browserAttribution(),
        storage,
      );
      goal("form_submit");
      const response = await fetch(
        process.env.NEXT_PUBLIC_LEADS_API_URL || "/api/leads",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ ...body, turnstileToken }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (
        !response.ok ||
        payload.ok !== true ||
        payload.saved !== true ||
        typeof payload.id !== "string" ||
        !/^[A-Za-z0-9_-]{20,80}$/.test(payload.id)
      ) {
        reason =
          response.status === 429
            ? "rate_limit"
            : response.status === 409
              ? "conflict"
              : response.status === 400
                ? "server_validation"
                : response.ok
                  ? "unconfirmed"
                  : "server";
        if ([400, 409, 429].includes(response.status))
          setErrorMessage(
            typeof payload.message === "string"
              ? payload.message.slice(0, 300)
              : "Проверьте данные и повторите отправку.",
          );
        if (response.status === 413)
          setErrorMessage(
            "Слишком много данных. Сократите описание задачи и повторите отправку.",
          );
        throw new Error("Save not confirmed");
      }
      setLeadId(payload.id);
      setStatus("success");
      if (acknowledgeLead(payload.id, storage)) {
        goal("lead_saved");
        goal("form_success");
      }
      reset();
      started.current = false;
      resetChallenge();
    } catch {
      setStatus("error");
      goal("form_error", {
        reason: controller.signal.aborted ? "timeout" : reason,
      });
      resetChallenge();
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <form
      className={`lead-form ${compact ? "compact" : ""}`}
      noValidate
      data-lead-form
      aria-describedby={`${formId}-requirements`}
      onFocusCapture={(event) => {
        if (
          !(event.target instanceof HTMLElement) ||
          !event.target.matches(
            "input:not([name=website_check]), textarea, button[type=submit]",
          )
        )
          return;
        if (!started.current) {
          started.current = true;
          goal("form_start");
        }
      }}
      onChangeCapture={() => {
        if (status !== "idle") setStatus("idle");
      }}
      onSubmit={(event) => {
        void handleSubmit(onSubmit, (invalid) => {
          setStatus("idle");
          goal("form_error", {
            reason: "validation",
            fields: Object.keys(invalid)
              .filter((key) => key !== "website_check")
              .sort()
              .join(","),
          });
        })(event);
      }}
    >
      <p className="form-requirements" id={`${formId}-requirements`}>
        Имя, компания и контакт — обязательные поля.
      </p>
      <fieldset
        className="lead-form-fields"
        disabled={isSubmitting || sending}
        aria-label="Данные для предварительного разбора"
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
          <input
            required
            maxLength={100}
            autoComplete="name"
            className="ym-disable-keys"
            {...register("name")}
          />
        </Field>
        <Field label="Компания / клиника" error={errors.company?.message}>
          <input
            required
            maxLength={160}
            autoComplete="organization"
            className="ym-disable-keys"
            {...register("company")}
          />
        </Field>
        <Field
          label="Телефон или мессенджер"
          hint="Можно указать email"
          error={errors.phone?.message}
          inputLabel="Телефон или мессенджер"
        >
          <input
            required
            maxLength={100}
            autoComplete="tel"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="+7…, @telegram или email"
            className="ym-disable-keys"
            {...register("phone")}
          />
        </Field>
        <Field label="Сайт" hint="если есть" error={errors.website?.message}>
          <input
            maxLength={300}
            inputMode="url"
            autoCapitalize="none"
            placeholder="clinic.ru"
            className="ym-disable-keys"
            {...register("website")}
          />
        </Field>
        {!compact && (
          <Field
            label="Что сейчас хотелось бы улучшить?"
            hint="необязательно"
            error={errors.message?.message}
          >
            <textarea
              rows={4}
              maxLength={1000}
              className="ym-disable-keys"
              {...register("message")}
            />
          </Field>
        )}
        <label className="consent">
          <input
            type="checkbox"
            required
            aria-invalid={!!errors.consent}
            aria-describedby={
              errors.consent ? `${formId}-consent-error` : undefined
            }
            {...register("consent")}
          />
          <span>
            Согласен на обработку персональных данных согласно{" "}
            <a href="/soglasheniya" target="_blank" rel="noopener noreferrer">
              политике
            </a>
            .
          </span>
        </label>
        {errors.consent && (
          <p id={`${formId}-consent-error`} className="field-error">
            {errors.consent.message}
          </p>
        )}
        {Object.keys(errors).length > 0 && (
          <p className="field-error" role="alert">
            Проверьте отмеченные поля. Введённые данные остались в форме.
          </p>
        )}
        {siteKey && (
          <>
            <Script
              id="kvc-turnstile"
              src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
              strategy="afterInteractive"
              onReady={mountChallenge}
            />
            <div ref={widget} className="turnstile-widget" />
          </>
        )}
        <button
          className="button button-primary submit-button"
          disabled={isSubmitting || sending}
          type="submit"
        >
          {isSubmitting || sending ? (
            <>
              <CircleNotch className="spinner" size={20} /> Отправляем…
            </>
          ) : (
            "Получить предварительный разбор"
          )}
        </button>
        <p className="form-note">
          Не указывайте сведения о пациентах и их здоровье. Изучим открытые
          данные и свяжемся для уточнения задачи. Без обязательств на дальнейшее
          сотрудничество.
        </p>
      </fieldset>
      <div
        ref={statusRef}
        tabIndex={-1}
        className={`form-status ${status}`}
        aria-live={status === "error" ? "assertive" : "polite"}
        role={status === "error" ? "alert" : "status"}
      >
        {status === "success" && (
          <>
            <CheckCircle size={22} weight="fill" />
            <span>
              Заявка принята. Номер: {leadId}. Свяжемся после предварительного
              изучения данных.
            </span>
          </>
        )}
        {status === "error" && (
          <>
            <WarningCircle size={22} weight="fill" />
            <span>
              {errorMessage ||
                "Не удалось подтвердить приём заявки. Проверьте соединение и повторите отправку с теми же данными."}
            </span>
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
  inputLabel,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  inputLabel?: string;
  children: React.ReactElement<{
    id?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
    "aria-label"?: string;
  }>;
}) {
  const id = useId();
  return (
    <label className="form-field" htmlFor={id}>
      <span>
        {label}
        {hint && <small id={`${id}-hint`}>{hint}</small>}
      </span>
      {cloneElement(children, {
        id,
        "aria-invalid": !!error,
        "aria-label": inputLabel,
        "aria-describedby":
          [hint && `${id}-hint`, error && `${id}-error`]
            .filter(Boolean)
            .join(" ") || undefined,
      })}
      {error && (
        <em id={`${id}-error`} className="field-error">
          {error}
        </em>
      )}
    </label>
  );
}
