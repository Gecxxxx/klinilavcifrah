"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";
import { useState } from "react";
import { navItems } from "@/lib/site-data";

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
          <Image
            className="brand-logo"
            src="/assets/logo.webp"
            alt=""
            width={38}
            height={38}
            priority
          />
          <span>КЛИНИКА В ЦИФРАХ</span>
        </Link>
        <nav className="desktop-nav" aria-label="Основная навигация">
          {navItems.map((item) => (
            <Link
              className={pathname === item.href ? "active" : ""}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          className="button button-outline header-cta"
          href="/kontakty#forma"
        >
          Получить разбор
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
        <Link
          className="button button-primary"
          href="/kontakty#forma"
          onClick={() => setOpen(false)}
        >
          Получить разбор
        </Link>
      </div>
    </header>
  );
}
