import { Hanken_Grotesk } from "next/font/google";
import localFont from "next/font/local";

// Statements. Fontshare free licence: commercial use and self-hosting allowed,
// files served as shipped. Weight 300 for 44px and up, 400 below; never under 24px.
export const zodiak = localFont({
  src: [
    { path: "../fonts/zodiak-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../fonts/zodiak-300-italic.woff2", weight: "300", style: "italic" },
    { path: "../fonts/zodiak-400-normal.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-zodiak",
  display: "swap",
});

// UI. Tabular digits by default, which the timer relies on.
export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hanken",
  display: "swap",
});

// Code, HUD labels and timecodes. Ligatures off by default; Monaco also gets
// fontLigatures: false so a candidate always sees what they typed.
export const commit = localFont({
  src: [
    { path: "../fonts/commit-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/commit-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/commit-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-commit",
  display: "swap",
});
