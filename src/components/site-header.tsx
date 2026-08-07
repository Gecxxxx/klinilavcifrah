"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretDown, List, X } from "@phosphor-icons/react";
import { useState } from "react";
import { directionLinks, navItems } from "@/lib/site-data";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link
          className="brand"
          href="/"
          aria-label="Клиника в цифрах — главная"
        >
          КЛИНИКА В ЦИФРАХ
        </Link>
        <nav className="desktop-nav" aria-label="Основная навигация">
          {navItems.slice(1).map((item) =>
            item.dropdown ? (
              <div className="nav-dropdown" key={item.href}>
                <Link
                  className={
                    pathname.startsWith("/chto") ||
                    directionLinks.some((x) => x.href === pathname)
                      ? "active"
                      : ""
                  }
                  href={item.href}
                >
                  {item.label}
                  <CaretDown size={14} weight="bold" />
                </Link>
                <div className="dropdown-panel">
                  <Link href="/chto-my-delaem">Обзор системы</Link>
                  {directionLinks.map((link) => (
                    <Link href={link.href} key={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                className={pathname === item.href ? "active" : ""}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <Link
          className="button button-outline header-cta"
          href="/kontakty#forma"
        >
          Получить предварительный разбор
        </Link>
        <button
          className="menu-toggle"
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
        >
          {open ? <X size={25} /> : <List size={27} />}
        </button>
      </div>
      <div className={`mobile-menu ${open ? "open" : ""}`} id="mobile-menu">
        {navItems.map((item) => (
          <Link href={item.href} key={item.href} onClick={() => setOpen(false)}>
            {item.label}
          </Link>
        ))}
        <div className="mobile-directions">
          {directionLinks.map((link) => (
            <Link
              href={link.href}
              key={link.href}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <Link
          className="button button-primary"
          href="/kontakty#forma"
          onClick={() => setOpen(false)}
        >
          Получить предварительный разбор
        </Link>
      </div>
    </header>
  );
}
