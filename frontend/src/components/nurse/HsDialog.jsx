// HsDialog.jsx
// Dialog shell for the Health Screening page (the -hs overlay / modal / header look). Adds what the markup lacked:
// role="dialog", aria-modal, a title link, Esc to close, focus kept inside, focus back to the opener on close.
// Only the top-most open dialog answers Esc and Tab, so a prompt opened over another dialog closes alone
// (a shared Modal / alert open on top takes both keys).
import React, { createContext, useContext, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const TitleContext = createContext(undefined);
const openStack = [];

/**
 * size:    '' | 'sm' | 'lg'
 * zIndex:  raise a dialog that opens over another one
 * onClose: Esc and the header close button
 */
export function HsDialog({ onClose, size = '', zIndex, children }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const panel = panelRef.current;
    const opener = document.activeElement;
    const token = {};
    openStack.push(token);

    // autoFocus fields already took focus on mount; only move it when nothing inside has it
    if (panel && !panel.contains(document.activeElement)) {
      const body = panel.querySelector('.modal-body-hs');
      (body?.querySelector(FOCUSABLE) || panel.querySelector(FOCUSABLE) || panel).focus();
    }

    const onKey = (e) => {
      if (openStack[openStack.length - 1] !== token) return;
      // an alert / confirm of the shared Modal is open over this dialog: it owns Esc and Tab
      if (document.querySelector('.shared-modal-backdrop')) return;
      if (e.key === 'Escape') {
        closeRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const at = openStack.indexOf(token);
      if (at >= 0) openStack.splice(at, 1);
      if (opener && document.contains(opener) && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  return (
    <TitleContext.Provider value={titleId}>
      <div className="modal-overlay-hs" style={zIndex ? { zIndex } : undefined}>
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`modal-hs ${size ? `modal-${size}-hs` : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          {children}
        </div>
      </div>
    </TitleContext.Provider>
  );
}

/**
 * children: the title. sub: line under the title. actions: buttons placed before the close button.
 * icon: lucide component shown in a tile before the title. center: block pushed to the right of the title (a stepper).
 */
export function HsDialogHeader({ onClose, sub, actions, icon: Icon, center, children }) {
  const titleId = useContext(TitleContext);
  const title = <h2 id={titleId}>{children}</h2>;
  // no onClose = a dialog that has to be completed first: no close button
  const close = onClose ? (
    <button type="button" className="close-btn-hs" onClick={onClose} aria-label="Close">
      <X size={20} aria-hidden="true" />
    </button>
  ) : null;
  return (
    <div className="modal-header-hs">
      {Icon && <span className="modal-ico-hs"><Icon size={20} aria-hidden="true" /></span>}
      <div className="modal-title-wrap-hs">{title}{sub}</div>
      {center && <div className="modal-center-hs">{center}</div>}
      {actions ? <div className="modal-header-actions-hs">{actions}{close}</div> : close}
    </div>
  );
}
