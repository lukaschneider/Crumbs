export type EmptyStateIconKind =
  | "capture"
  | "tree"
  | "hex"
  | "no-matches"
  | "missing"
  | "settings"
  | "lock"
  | "clock"
  | "columns"
  | "warning";

const captureSymbols = {
  capture: <path d="M15 28h20M15 36h12M15 44h6M28 44h7" />,
  missing: (
    <>
      <circle cx="24" cy="33" r="7" />
      <path d="m29 38 7 7" />
    </>
  ),
  settings: (
    <>
      <path d="M15 30h5m6 0h9M15 43h12m6 0h2" />
      <circle cx="23" cy="30" r="3" />
      <circle cx="30" cy="43" r="3" />
    </>
  ),
  lock: (
    <>
      <rect x="17" y="34" width="16" height="13" rx="2" />
      <path d="M21 34v-5a4 4 0 0 1 8 0v5M25 39v3" />
    </>
  ),
  clock: (
    <>
      <circle cx="25" cy="36" r="10" />
      <path d="M25 30v7l4 2" />
    </>
  ),
  columns: (
    <>
      <rect x="14" y="26" width="22" height="22" rx="2" />
      <path d="M14 32h22M21 26v22M28 26v22" />
    </>
  ),
  warning: <path d="m25 26 12 22H13ZM25 33v7M25 44h.01" />,
};

export function EmptyStateIcon({ kind }: { kind: EmptyStateIconKind }) {
  return (
    <svg
      className="empty-state-mark"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "tree" ? (
        <>
          <path d="M15 19v31h16M15 32h16" />
          <rect x="7" y="7" width="18" height="12" rx="2" />
          <rect x="31" y="26" width="26" height="12" rx="2" />
          <rect x="31" y="44" width="26" height="12" rx="2" />
        </>
      ) : kind === "hex" ? (
        <>
          <rect x="7" y="9" width="50" height="46" rx="3" />
          <path d="M7 22h50M24 9v46M13 16h5M30 16h6M43 16h6M13 32h5M13 45h5" />
          <rect x="30" y="28" width="6" height="9" rx="1.5" />
          <path d="M43 37v-9h6M43 32h5M30 49v-7l3-2 3 2v7M30 45h6" />
          <rect x="43" y="40" width="6" height="9" rx="1.5" />
        </>
      ) : kind === "no-matches" ? (
        <>
          <path d="M8 10h48v6L36 36v16l-8 4V36L8 16Z" />
          <circle cx="49" cy="46" r="9" />
          <path d="M45 46h8" />
        </>
      ) : (
        <>
          <path d="M14 13V9a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v34a3 3 0 0 1-3 3h-4" />
          <rect x="7" y="17" width="36" height="40" rx="3" />
          {captureSymbols[kind]}
        </>
      )}
    </svg>
  );
}
