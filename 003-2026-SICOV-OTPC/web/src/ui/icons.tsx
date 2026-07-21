// Iconos SVG propios (stroke), sin dependencias externas.
import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const, ...p,
})

export const Ic = {
  grid: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>),
  truck: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>),
  inbox: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 13l2-8h12l2 8"/><path d="M4 13v5a1 1 0 001 1h14a1 1 0 001-1v-5"/><path d="M4 13h5l1 2h4l1-2h5"/></svg>),
  wrench: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M15 6a4 4 0 00-5.3 4.8L4 16.5 6.5 19l5.7-5.7A4 4 0 0018 8.9L15.6 11 13 8.4z"/></svg>),
  alert: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 4l9 15H3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>),
  ticket: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 8a2 2 0 012-2h12a2 2 0 012 2 2 2 0 000 4 2 2 0 010 4H6a2 2 0 01-2-2 2 2 0 000-4z"/><path d="M14 6v12" strokeDasharray="2 2"/></svg>),
  users: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0"/><path d="M16 6a3 3 0 010 6"/><path d="M18 20a6 6 0 00-3-5"/></svg>),
  route: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h6a3 3 0 003-3V9"/></svg>),
  link: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M9 15l6-6"/><path d="M10.5 6.5l1-1a3.5 3.5 0 015 5l-1 1"/><path d="M13.5 17.5l-1 1a3.5 3.5 0 01-5-5l1-1"/></svg>),
  search: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/></svg>),
  bell: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 004 0"/></svg>),
  logout: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4"/><path d="M15 12H9"/><path d="M13 8l4 4-4 4"/></svg>),
  plus: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 5v14M5 12h14"/></svg>),
  upload: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>),
  download: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M4 19h16"/></svg>),
  refresh: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M20 11a8 8 0 00-14-5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0014 5l2-2"/><path d="M20 20v-4h-4"/></svg>),
  chevron: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M9 6l6 6-6 6"/></svg>),
  clock: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>),
  check: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 12l5 5 9-11"/></svg>),
  shield: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>),
  building: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></svg>),
  pin: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>),
  file: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M6 3h8l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v4h4"/></svg>),
}

export type IconKey = keyof typeof Ic
