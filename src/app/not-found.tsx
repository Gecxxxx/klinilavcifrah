import Link from "next/link";
export default function NotFound() {
  return (
    <section className="not-found dark-section">
      <div>
        <span>404</span>
        <h1>Страница не найдена</h1>
        <p>
          Вернитесь к коммерческой системе или оставьте запрос на
          предварительный разбор.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/">
            На главную
          </Link>
          <Link className="button button-ghost" href="/kontakty#forma">
            Получить разбор
          </Link>
        </div>
      </div>
    </section>
  );
}
