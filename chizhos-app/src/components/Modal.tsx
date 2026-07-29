"use client";

import { ReactNode } from "react";
import Icon from "@/components/Icon";

export default function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-center" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
            {subtitle && (
              <div className="muted" style={{ fontSize: 12 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button className="close-x" onClick={onClose} aria-label="Закрыть">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="form-body">{children}</div>
      </div>
    </div>
  );
}
