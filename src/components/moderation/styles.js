// The Druppr operations look, as on the Partner Program page: white surfaces, readable tables and
// brand purple kept for the primary action, links and focus rings.

export const controlClass =
  "h-10 w-full rounded-lg border border-gray300 bg-white px-3 text-sm text-gray900 outline-none transition focus:border-[#6d3adf] focus:ring-4 focus:ring-[#ede7ff] disabled:bg-gray100";
export const textAreaClass =
  "w-full rounded-lg border border-gray300 bg-white p-3 text-sm text-gray900 outline-none transition focus:border-[#6d3adf] focus:ring-4 focus:ring-[#ede7ff] disabled:bg-gray100";
export const primaryButton =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-[#6d3adf] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5b2bc4] focus:outline-none focus:ring-4 focus:ring-[#dcd0ff] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButton =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-gray300 bg-white px-3 py-2 text-sm font-semibold text-gray700 transition hover:border-[#8a5cf6] hover:bg-[#f8f5ff] hover:text-[#5b2bc4] focus:outline-none focus:ring-4 focus:ring-[#ede7ff] disabled:cursor-not-allowed disabled:opacity-50";
export const dangerButton =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-50";
export const linkClass =
  "rounded font-semibold text-[#5b2bc4] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#dcd0ff]";
export const cardClass = "rounded-xl border border-gray200 bg-white p-5 shadow-sm";
export const labelClass = "block text-sm font-semibold text-gray700";
export const eyebrowClass = "text-xs font-semibold uppercase tracking-wider text-gray500";
// ⚠️ `relative` is load-bearing: the table holds screen-reader-only (absolutely positioned) labels,
// and without a positioned ancestor they escape the scroll box and make the whole page scroll
// sideways on a phone.
export const tableWrapClass = "relative overflow-x-auto rounded-xl border border-gray200 bg-white shadow-sm";
export const tableClass = "w-full min-w-[880px] text-left text-sm";
export const headCellClass = "px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray600";
export const cellClass = "px-3 py-3 align-top text-gray700";

export const TONES = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  neutral: "border-gray-200 bg-gray-100 text-gray-700",
  brand: "border-[#dcd0ff] bg-[#faf8ff] text-[#5b2bc4]",
};

/** DISABLED · AVAILABLE · ENFORCED (and a policy's PUBLISHED · NOT PUBLISHED). */
export const STATE_TONES = {
  DISABLED: "neutral",
  AVAILABLE: "info",
  ENFORCED: "success",
  PUBLISHED: "success",
  "NOT PUBLISHED": "neutral",
};
