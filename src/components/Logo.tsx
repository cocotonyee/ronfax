import type { SVGProps } from "react";

type LogoProps = SVGProps<SVGSVGElement> & {
  /** Visual height in px; default 32 */
  size?: number;
};

/**
 * RonFax mark — scales cleanly; default height 32px per brand spec.
 */
export function Logo({ size = 32, className, ...props }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden
      {...props}
    >
      <rect width="40" height="40" rx="8" fill="#009cff" />
      <path
        d="M12 10C10.8954 10 10 10.8954 10 12V28C10 29.1046 10.8954 30 12 30H28C29.1046 30 30 29.1046 30 28V16L24 10H12Z"
        fill="white"
      />
      <path
        d="M24 10V16H30L24 10Z"
        fill="#007acc"
        fillOpacity={0.8}
      />
      <rect
        x="14"
        y="18"
        width="12"
        height="2"
        rx="1"
        fill="#009cff"
        fillOpacity={0.3}
      />
      <rect
        x="14"
        y="22"
        width="12"
        height="2"
        rx="1"
        fill="#009cff"
        fillOpacity={0.3}
      />
      <rect
        x="14"
        y="26"
        width="8"
        height="2"
        rx="1"
        fill="#009cff"
        fillOpacity={0.3}
      />
    </svg>
  );
}
