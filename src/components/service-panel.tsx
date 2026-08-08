"use client";

import { useEffect, useState } from "react";
import {
  CaretDown,
  CheckCircle,
  Database,
  Eye,
  Gauge,
  Wrench,
} from "@phosphor-icons/react";

const sectionIcons = [Eye, Gauge, Wrench, CheckCircle, Database];
const compactQuery = "(max-width: 1024px)";

type ServicePanelProps = {
  index: number;
  number: string;
  title: string;
  items: string[];
};

export function ServicePanel({
  index,
  number,
  title,
  items,
}: ServicePanelProps) {
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(index === 0);
  const expanded = !compact || open;
  const Icon = sectionIcons[index];
  const contentId = `service-panel-${index + 1}-content`;

  useEffect(() => {
    const media = window.matchMedia(compactQuery);
    const updateLayout = () => setCompact(media.matches);
    updateLayout();
    media.addEventListener("change", updateLayout);
    return () => media.removeEventListener("change", updateLayout);
  }, []);

  return (
    <article
      className={`service-panel panel-${index + 1}${expanded ? " is-open" : ""}`}
    >
      <header>
        <span>{number}</span>
        <Icon size={29} weight="duotone" />
        <h2>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            disabled={!compact}
            onClick={() => setOpen((value) => !value)}
          >
            <span>{title}</span>
            <small>{items.length} пунктов</small>
            <CaretDown
              className="service-panel-caret"
              size={22}
              weight="bold"
              aria-hidden="true"
            />
          </button>
        </h2>
      </header>
      <ul id={contentId} hidden={!expanded}>
        {items.map((item) => (
          <li key={item}>
            <CheckCircle size={18} weight="duotone" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
