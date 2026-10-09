/* eslint-disable react/prop-types -- this app declares no prop-types dependency; props are documented on each component. */
import { useEffect, useId, useRef, useState } from "react";
import { MdContentCopy } from "react-icons/md";
import ReactPaginate from "react-paginate";
import { Link, NavLink } from "react-router-dom";
import { paginationView, shortId, validateNote } from "../../utils/moderation";
import {
  TONES,
  dangerButton,
  labelClass,
  linkClass,
  primaryButton,
  secondaryButton,
  textAreaClass,
} from "./styles";

const SECTIONS = [
  { to: "/moderation", label: "Overview", end: true },
  { to: "/moderation/reports", label: "Reports" },
  { to: "/moderation/audit", label: "Audit history" },
];

/** The frame every moderation screen shares. Props: title, description, aside (optional), children. */
export function ModerationPage({ title, description, aside, children }) {
  return (
    <main className="min-h-screen bg-gray50 px-4 py-6 text-gray900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <header className="border-b border-gray200 pb-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6d3adf]">Druppr operations · Moderation</p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray900 sm:text-3xl">{title}</h1>
              {description ? <p className="mt-2 max-w-3xl text-sm text-gray600">{description}</p> : null}
            </div>
            {aside}
          </div>
          <nav aria-label="Moderation sections" className="mt-4 flex flex-wrap gap-2">
            {SECTIONS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `rounded-lg border px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-[#ede7ff] ${
                    isActive
                      ? "border-[#6d3adf] bg-[#6d3adf] text-white"
                      : "border-gray300 bg-white text-gray700 hover:border-[#8a5cf6] hover:text-[#5b2bc4]"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}

/** A status chip. The text carries the meaning; the colour only supports it. Props: tone, children. */
export function Badge({ tone = "neutral", children }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide ${TONES[tone] ?? TONES.neutral}`}
    >
      {children}
    </span>
  );
}

/** A message. An error is announced at once; anything else politely. Props: tone, title, children. */
export function Notice({ tone = "info", title, children }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${TONES[tone] ?? TONES.info}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
    </div>
  );
}

/** Label / value pairs. Props: facts — [[label, value], …]. */
export function Facts({ facts }) {
  if (!facts?.length) return null;
  return (
    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
      {facts.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-white/70 p-2">
          <dt className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</dt>
          <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * An identifier, shortened for reading with the whole value one click away. The backend gives the
 * queue and the audit trail identifiers only, so that is what is shown — never an invented name.
 * Props: id, label (what the ID identifies, for the copy button's name).
 */
export function IdText({ id, label = "this" }) {
  const [copied, setCopied] = useState(false);
  if (!id) return <span className="text-gray500">—</span>;
  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <span className="inline-flex items-center gap-1">
      <code title={id} className="rounded bg-gray100 px-1.5 py-0.5 text-xs text-gray800">
        {shortId(id)}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label} ID`}
        className="rounded p-1 text-gray500 hover:text-[#5b2bc4] focus:outline-none focus:ring-2 focus:ring-[#dcd0ff]"
      >
        <MdContentCopy size={14} aria-hidden="true" />
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </span>
  );
}

/** Placeholder rows while something loads. Props: label (announced to a screen reader), rows. */
export function LoadingRows({ label = "Loading…", rows = 4 }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-lg bg-gray100" />
      ))}
    </div>
  );
}

/** Props: title, children. */
export function EmptyState({ title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-gray300 bg-white px-4 py-8 text-center">
      <p className="font-semibold text-gray800">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-2xl text-sm text-gray600">{children}</div> : null}
    </div>
  );
}

/** Paging from the backend's own metadata. Props: meta, onPage(pageNumber), label, disabled. */
export function Pager({ meta, onPage, label = "Pages" }) {
  const view = paginationView(meta);
  if (view.itemCount === 0) return null;
  return (
    <nav aria-label={label} className="flex flex-col items-center gap-2 text-sm text-gray600 sm:flex-row sm:justify-between">
      <p>
        Showing {view.from}–{view.to} of {view.itemCount}
      </p>
      {view.hasPages ? (
        <ReactPaginate
          breakLabel="…"
          previousLabel="‹ Previous"
          nextLabel="Next ›"
          onPageChange={(event) => onPage(event.selected + 1)}
          forcePage={view.page - 1}
          pageCount={view.pageCount}
          pageRangeDisplayed={3}
          marginPagesDisplayed={1}
          renderOnZeroPageCount={null}
          containerClassName="pagination !mt-0 flex-wrap"
          activeClassName="active"
        />
      ) : null}
    </nav>
  );
}

function signOut() {
  // The same sign-out the navigation bar performs.
  localStorage.removeItem("CRMuser");
  localStorage.removeItem("CRMACCESSTOKEN");
  window.location.href = "/login";
}

/**
 * A failed load, by kind. ⚠️ A refusal is always shown: the portal's shared client is silent on 403.
 * Props: error ({ kind, message }), onRetry (optional).
 */
export function ErrorState({ error, onRetry }) {
  if (!error) return null;
  if (error.kind === "forbidden") {
    return (
      <Notice tone="error" title="Administrator access required">
        <p>{error.message}</p>
        <p className="mt-1">No moderation data was loaded.</p>
        <button type="button" onClick={signOut} className={`${secondaryButton} mt-3`}>
          Sign out
        </button>
      </Notice>
    );
  }
  if (error.kind === "session") {
    return (
      <Notice tone="error" title="Your session has ended">
        <p>{error.message}</p>
        <Link to="/login" className={`${linkClass} mt-2 inline-block`}>
          Go to sign-in
        </Link>
      </Notice>
    );
  }
  return (
    <Notice tone="error" title={error.kind === "not_found" ? "Not found" : "This could not be loaded"}>
      <p>{error.message}</p>
      {onRetry && error.kind !== "not_found" ? (
        <button type="button" onClick={onRetry} className={`${secondaryButton} mt-3`}>
          Try again
        </button>
      ) : null}
    </Notice>
  );
}

const FOCUSABLE = "button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]), a[href]";

/**
 * A confirmation that must be answered. Focus moves in, stays in, and returns to where it was;
 * Escape and the backdrop cancel unless a request is in flight. The first field takes focus when
 * there is one, otherwise Cancel — never the confirming button.
 * Props: title, children, confirmLabel, busyLabel, tone ("danger" | "primary"), busy,
 * confirmDisabled, error (shown in place, so a refusal is read where it was caused),
 * onConfirm(), onClose().
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel = "Working…",
  tone = "primary",
  busy = false,
  confirmDisabled = false,
  error = "",
  onConfirm,
  onClose,
}) {
  const titleId = useId();
  const bodyId = useId();
  const panel = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const node = panel.current;
    (node?.querySelector(FOCUSABLE) ?? node)?.focus();
    return () => {
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, []);

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...(panel.current?.querySelectorAll(FOCUSABLE) ?? [])];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="modalBG"
      style={{ zIndex: 60 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-[560px] rounded-xl bg-white p-5 shadow-xl outline-none"
      >
        <h2 id={titleId} className="text-lg font-semibold text-gray900">
          {title}
        </h2>
        <div id={bodyId} className="mt-3 space-y-3 text-sm text-gray700">
          {children}
        </div>
        {error ? (
          <div role="alert" className={`mt-3 rounded-lg border px-3 py-2 text-sm font-medium ${TONES.error}`}>
            {error}
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" className={secondaryButton} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={tone === "danger" ? dangerButton : primaryButton}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * The reason (or note) an action is recorded with. Props: id, label, value, onChange(text), max,
 * required, disabled, hint.
 */
export function ReasonField({ id, label, value, onChange, max, required = false, disabled = false, hint }) {
  const check = validateNote(value, { required, max });
  // An untouched field shows its hint; once something is typed, what is wrong with it is said.
  const showError = !check.ok && value.length > 0;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        value={value}
        disabled={disabled}
        required={required}
        aria-describedby={`${id}-hint`}
        aria-invalid={showError}
        onChange={(event) => onChange(event.target.value)}
        className={`${textAreaClass} mt-2`}
      />
      <div id={`${id}-hint`} className="mt-1 flex justify-between gap-3 text-xs">
        <span className={showError ? "font-medium text-rose-700" : "text-gray500"}>{showError ? check.error : hint}</span>
        <span className="whitespace-nowrap text-gray500">
          {check.count} / {max}
        </span>
      </div>
    </div>
  );
}
