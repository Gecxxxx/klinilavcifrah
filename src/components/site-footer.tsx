import Link from "next/link";
import { directionLinks } from "@/lib/site-data";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link className="brand footer-brand" href="/">
            КЛИНИКА В ЦИФРАХ
          </Link>
          <p>Внешний коммерческий контур для частных клиник.</p>
        </div>
        <div>
          <strong>Направления</strong>
          {directionLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
        <div>
          <strong>Компания</strong>
          <Link href="/kak-rabotaem">Как работаем</Link>
          <Link href="/kejsy-i-razbory">Кейсы и разборы</Link>
          <Link href="/kontakty">Контакты</Link>
        </div>
        <div>
          <strong>Для клиник</strong>
          <Link href="/dlya-klinik#stomatologii">Стоматологии</Link>
          <Link href="/dlya-klinik#medicinskie-kliniki">
            Медицинские клиники
          </Link>
          <Link href="/dlya-klinik#kosmetologiya">Косметология</Link>
          <Link href="/kontakty#forma">Получить разбор</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Клиника в цифрах</span>
        <Link href="/soglasheniya">Соглашения и конфиденциальность</Link>
      </div>
    </footer>
  );
}
