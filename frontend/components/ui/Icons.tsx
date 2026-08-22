import type { SVGProps } from "react";

export type IconName =
  | "alert"
  | "arrow"
  | "check"
  | "chevron"
  | "doctor"
  | "eye"
  | "eyeOff"
  | "leaf"
  | "logout"
  | "meal"
  | "pantry"
  | "scan"
  | "sparkles";

const paths: Record<IconName, React.ReactNode> = {
  alert: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  doctor: (
    <>
      <path d="M9 3h6v4H9z" />
      <path d="M5 7h14v14H5z" />
      <path d="M12 10v8m-4-4h8" />
    </>
  ),
  eye: (
    <>
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M6.5 6.6C3.4 8.4 1.5 12 1.5 12S5 19 12 19c1.8 0 3.4-.4 4.8-1.1" />
      <path d="M17.4 17.4C19.9 15.8 22.5 12 22.5 12S19 5 12 5c-.9 0-1.8.1-2.6.4" />
      <path d="M2 2l20 20" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4C10 4 4 9 4 17c4 1 10 0 13-4 2-3 3-9 3-9Z" />
      <path d="M4 20c2-5 6-8 12-11" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l5-5-5-5m5 5H3" />
      <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
    </>
  ),
  meal: (
    <>
      <path d="M4 3v8a3 3 0 0 0 3 3V3M4 8h6m-3 6v7" />
      <path d="M17 3c-2 2-3 5-3 8 0 2 1 3 3 3v7m0-18v11" />
    </>
  ),
  pantry: (
    <>
      <path d="M4 7h16l-1 14H5L4 7Z" />
      <path d="M8 7V4h8v3M9 11v6m6-6v6" />
    </>
  ),
  scan: (
    <>
      <path d="M3 9V5a2 2 0 0 1 2-2h4m6 0h4a2 2 0 0 1 2 2v4M3 15v4a2 2 0 0 0 2 2h4m6 0h4a2 2 0 0 0 2-2v-4" />
      <path d="M7 12h10" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
      <path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Zm13-2 .8 2.2L21 15l-2.2.8L18 18l-.8-2.2L15 15l2.2-.8L18 12Z" />
    </>
  ),
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
