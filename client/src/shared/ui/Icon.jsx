// Inline SVG line icons: 24 grid, 2px stroke, round caps (docs/design/ui.md, "Status system").
// Decorative by default; the text next to an icon carries the meaning.

const PATHS = {
  thermometer: (
    <>
      <path d="M14 14.8V4.5a2 2 0 1 0-4 0v10.3a4 4 0 1 0 4 0z" />
      <path d="M12 9v7" />
    </>
  ),
  navOverview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  navUpload: (
    <>
      <path d="M12 15V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </>
  ),
  navInspector: (
    <>
      <path d="M9 4h6v3H9z" />
      <path d="M15 5.5h2.5a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1H9" />
      <path d="M9 14l2 2 4-4.5" />
    </>
  ),
  navLoggers: (
    <>
      <path d="M14 14.8V4.5a2 2 0 1 0-4 0v10.3a4 4 0 1 0 4 0z" />
      <path d="M12 9v7" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  themeSystem: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" />
    </>
  ),
};

/**
 * @param {{ name: keyof typeof PATHS, size?: number, className?: string }} props
 */
export function Icon({ name, size = 18, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
