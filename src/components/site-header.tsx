"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { navItems } from "@/lib/site-data";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const outside = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("click", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("click", outside);
    };
  }, [open]);

  return (
    <header className="site-header" ref={header}>
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
          data-lead-cta="header"
          href="/kontakty#forma"
        >
          Получить разбор
        </Link>
        <button
          ref={toggle}
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
      <nav
        className={`mobile-menu ${open ? "open" : ""}`}
        id="mobile-menu"
        aria-label="Мобильная навигация"
        hidden={!open}
      >
        {navItems.map((item) => (
          <Link href={item.href} key={item.href} onClick={() => setOpen(false)}>
            {item.label}
          </Link>
        ))}
        <Link
          className="button button-primary"
          data-lead-cta="mobile_menu"
          href="/kontakty#forma"
          onClick={() => setOpen(false)}
        >
          Получить разбор
        </Link>
      </nav>
    </header>
  );
}
