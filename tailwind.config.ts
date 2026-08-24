import type { Config } from "tailwindcss";
import daisyui from "daisyui";

import { colors, fonts } from "./lib/config/design-tokens";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        asphalt: colors.asphalt,
        "asphalt-highlight": colors.asphaltHighlight,
        "off-white": colors.offWhite,
        "racing-red": colors.racingRed,
        "correct-green": colors.correctGreen,
      },
      fontFamily: {
        heading: [`var(${fonts.heading.variable})`, ...fonts.heading.fallback],
        body: [`var(${fonts.body.variable})`, ...fonts.body.fallback],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    // Fixed dark theme only — no light/dark toggle (CLAUDE.md design constraints).
    themes: [
      {
        f1forfun: {
          primary: colors.racingRed,
          secondary: colors.offWhite,
          accent: colors.correctGreen,
          neutral: colors.asphaltHighlight,
          "base-100": colors.asphalt,
          "base-200": colors.asphaltHighlight,
          "base-300": "#0d0f12",
          "base-content": colors.offWhite,
          info: "#3671c6",
          success: colors.correctGreen,
          warning: "#f6c000",
          error: colors.racingRed,
        },
      },
    ],
    darkTheme: "f1forfun",
    logs: false,
  },
};

export default config;
