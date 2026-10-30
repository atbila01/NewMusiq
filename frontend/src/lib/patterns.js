const G = "#d9a648"
const P = "#a577c4"
const C = "#f2d689"

const tiles = {
  evergreen: `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='64'><path d='M23 6 L33 24 H27 L36 40 H10 L19 24 H13 Z' fill='none' stroke='${G}' stroke-width='2'/><path d='M23 40 V50' stroke='${G}' stroke-width='2'/><path d='M4 60 L14 52 L22 58 L32 50 L42 60' fill='none' stroke='${P}' stroke-width='1.5'/></svg>`,
  surf: `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='56'><circle cx='23' cy='14' r='7' fill='none' stroke='${C}' stroke-width='2'/><path d='M23 2v3M23 23v3M11 14h3M32 14h3' stroke='${C}' stroke-width='1.5'/><path d='M2 40 Q12 28 22 40 T42 40 M2 50 Q12 38 22 50 T42 50' fill='none' stroke='${G}' stroke-width='2'/></svg>`,
  deco: `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='60'><path d='M23 4 L40 30 L23 56 L6 30 Z' fill='none' stroke='${G}' stroke-width='2'/><path d='M23 14 L33 30 L23 46 L13 30 Z' fill='none' stroke='${P}' stroke-width='1.5'/><path d='M23 4V56M6 30H40' stroke='${G}' stroke-width='.8'/></svg>`,
  canyon: `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='48'><path d='M23 4 L35 16 L23 28 L11 16 Z M23 10 L29 16 L23 22 L17 16 Z' fill='none' stroke='${G}' stroke-width='2'/><path d='M0 36 H8 V30 H16 V24 H30 V30 H38 V36 H46' fill='none' stroke='${P}' stroke-width='2'/><path d='M0 44 H46' stroke='${G}' stroke-width='1.5' stroke-dasharray='4 3'/></svg>`,
  lonestar: `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='60'><path d='M23 6 L27 18 L40 18 L29 26 L33 39 L23 31 L13 39 L17 26 L6 18 L19 18 Z' fill='none' stroke='${C}' stroke-width='2'/><path d='M6 50 C14 44 18 56 23 50 C28 44 32 56 40 50' fill='none' stroke='${G}' stroke-width='2'/></svg>`,
  western: `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='40'><path d='M10 0 C30 10 16 30 36 40' fill='none' stroke='${G}' stroke-width='3'/><path d='M36 0 C16 10 30 30 10 40' fill='none' stroke='${P}' stroke-width='1.5'/></svg>`,
  stars: `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='46'><path d='M23 8 L26 18 L36 18 L28 24 L31 34 L23 28 L15 34 L18 24 L10 18 L20 18 Z' fill='none' stroke='${G}' stroke-width='1.8'/><path d='M4 42 H42' stroke='${P}' stroke-width='1.5'/></svg>`,
  seigaiha: `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='24'><g fill='none' stroke='${G}' stroke-width='1.6'><circle cx='23' cy='24' r='20'/><circle cx='23' cy='24' r='13'/><circle cx='23' cy='24' r='6'/></g></svg>`,
  papel: `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='50'><path d='M4 4 H42 V36 L36 42 L30 36 L23 44 L16 36 L10 42 L4 36 Z' fill='none' stroke='${G}' stroke-width='2'/><circle cx='23' cy='18' r='6' fill='none' stroke='${P}' stroke-width='1.6'/><path d='M12 12l4 4M34 12l-4 4M12 26l4-4M34 26l-4-4' stroke='${C}' stroke-width='1.4'/></svg>`,
  kente: `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='46'><rect x='4' y='4' width='18' height='18' fill='none' stroke='${G}' stroke-width='2'/><rect x='24' y='24' width='18' height='18' fill='none' stroke='${G}' stroke-width='2'/><path d='M24 8 H42 M24 14 H42 M24 20 H42 M8 24 V42 M14 24 V42 M20 24 V42' stroke='${P}' stroke-width='1.6'/></svg>`,
  waves: `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='30'><path d='M0 15 Q11.5 3 23 15 T46 15' fill='none' stroke='${G}' stroke-width='2'/><circle cx='23' cy='26' r='2' fill='${P}'/></svg>`,
}

const STATE_PATTERNS = {
  Washington: "evergreen", Oregon: "evergreen", California: "surf", Nevada: "deco", Arizona: "canyon", Utah: "canyon",
  "New Mexico": "canyon", Texas: "lonestar", Montana: "western", Wyoming: "western", Nebraska: "western", Oklahoma: "western",
}
const COUNTRY_PATTERNS = {
  Japan: "seigaiha", Mexico: "papel", Ghana: "kente", Nigeria: "kente", "Côte d'Ivoire": "kente", Togo: "kente",
  Senegal: "kente", Mali: "kente", "United States of America": "stars",
}

export function regionPattern(country, state) {
  const key = STATE_PATTERNS[state] || COUNTRY_PATTERNS[country] || "waves"
  return { key, image: `url("data:image/svg+xml;utf8,${encodeURIComponent(tiles[key])}")` }
}
