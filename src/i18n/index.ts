import { bg } from "./bg";
import { en } from "./en";
import type { Locale } from "./config";

export type { Dictionary } from "./en";
export const getDictionary = (locale: Locale) => (locale === "en" ? en : bg);
