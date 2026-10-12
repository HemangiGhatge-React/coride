"use client";

import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

export interface DialogProps {
  open: boolean;
  /** Called on Esc and on a click outside the panel. The parent decides whether to close. */
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusableIn = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute("hidden"));

/**
 * Modal dialog. On open, focus moves inside (to the element marked `data-autofocus`, otherwise the
 * first focusable one); Tab and Shift+Tab stay inside; Esc and a click on the backdrop call
 * `onClose`; when it closes, focus returns to whatever had it before it opened (the trigger).
 */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // no scrolling the page behind the dialog

    const panel = panelRef.current;
    if (panel) {
      const target = panel.querySelector<HTMLElement>("[data-autofocus]") ?? focusableIn(panel)[0] ?? panel;
      target.focus();
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;

    const items = focusableIn(panelRef.current);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !panelRef.current.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      // Close on click, not mousedown: the browser moves focus to <body> as the default action of
      // mousedown, which would undo the focus return. Require the press to have started on the
      // backdrop too, so dragging a text selection out of the panel does not close it.
      onMouseDown={(event) => {
        pressStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressStartedOnBackdrop.current && event.target === event.currentTarget) onClose();
        pressStartedOnBackdrop.current = false;
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn("w-full max-w-md rounded-lg bg-white p-6 shadow-xl outline-none", className)}
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        {description && (
          <div id={descriptionId} className="mt-2 text-sm text-slate-600">
            {description}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
