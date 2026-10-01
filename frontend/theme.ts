/* NAVI-VICA design tokens — from the October 2026 mockup.
   Warm cream world, terracotta actions, Fraunces headings. */

export const colors = {
  bg: "#FBF4EA",          // app background
  card: "#FFFDF9",        // raised cards
  cardBorder: "#EADBC9",  // 1.5px card outline
  fieldBorder: "#E5D3BF",
  ink: "#3B2A20",         // primary text
  muted: "#6E5646",       // secondary text
  faint: "#A8937F",

  terra: "#B5482A",       // main action (mic, primary buttons)
  terraDeep: "#8E3720",   // brand text, section labels
  terraSoft: "#F4D9CC",   // icon chips / mic halo
  terraFaintBg: "#F5E6D6",

  green: "#4A6430",       // listening, all-good
  greenDeep: "#34481F",
  greenSoft: "#DFE6D2",

  red: "#9C2B1C",         // emergency
  redSoft: "#F3D3CD",
  redFaint: "#F8E6E2",

  purple: "#4B3F7A",      // health devices
  purpleSoft: "#E3E0F0",
  purpleFaint: "#EEEAF5",

  amber: "#7C5300",       // medicines
  amberDeep: "#5C3D00",
  amberSoft: "#F6E3B8",

  white: "#FFFFFF",
  lockBg: "#3B2A20",      // lock-screen alarm backdrop
};

export const font = {
  /* loaded in app/_layout.tsx via @expo-google-fonts */
  heading: "Fraunces_700Bold",
  headingMedium: "Fraunces_500Medium",
  body: "AtkinsonHyperlegible_400Regular",
  bodyBold: "AtkinsonHyperlegible_700Bold",
};

export const radius = {
  card: 22, tile: 24, chip: 18, pill: 29, round: 999,
};

export const space = {
  screen: 20, gap: 12, gapSm: 8, gapLg: 16,
};

export const type = {
  h1: { fontFamily: font.heading, fontSize: 30, lineHeight: 36, color: colors.ink },
  h2: { fontFamily: font.heading, fontSize: 26, lineHeight: 31, color: colors.ink },
  h3: { fontFamily: font.heading, fontSize: 24, lineHeight: 29, color: colors.ink },
  big: { fontFamily: font.heading, fontSize: 34, lineHeight: 39, color: colors.ink },
  label: {
    fontFamily: font.bodyBold, fontSize: 15, letterSpacing: 1.2,
    textTransform: "uppercase" as const, color: colors.terraDeep,
  },
  body: { fontFamily: font.body, fontSize: 17, lineHeight: 24, color: colors.ink },
  bodyBold: { fontFamily: font.bodyBold, fontSize: 17, lineHeight: 24, color: colors.ink },
  sub: { fontFamily: font.body, fontSize: 14, lineHeight: 19, color: colors.muted },
  button: { fontFamily: font.bodyBold, fontSize: 19, color: colors.white },
};
