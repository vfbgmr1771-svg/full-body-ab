type P = { size?: number };

function Svg({ size = 22, children }: P & { children: preact.ComponentChildren }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconBarbell = (p: P) => (
  <Svg {...p}>
    <path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12" />
  </Svg>
);
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="5" width="16" height="15" rx="3" />
    <path d="M8 3v4M16 3v4M4 11h16" />
  </Svg>
);
export const IconEgg = (p: P) => (
  <Svg {...p}>
    <path d="M12 3c3.5 0 6 5 6 9a6 6 0 0 1-12 0c0-4 2.5-9 6-9z" />
  </Svg>
);
export const IconSliders = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconArrowUp = (p: P) => (
  <Svg {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);
export const IconArrowDown = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Svg>
);
export const IconDot = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" fill="currentColor" />
  </Svg>
);
export const IconTrophy = (p: P) => (
  <Svg {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4" />
  </Svg>
);
export const IconSkip = (p: P) => (
  <Svg {...p}>
    <path d="M6 5l9 7-9 7V5zM19 5v14" />
  </Svg>
);
export const IconTimer = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="13" r="7" />
    <path d="M12 9v4l2 2M10 3h4" />
  </Svg>
);
