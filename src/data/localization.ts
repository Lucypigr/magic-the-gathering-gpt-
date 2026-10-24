import translations from "./localization/zh-rules.json";
import { isChineseCardLanguage } from "./names";

const rules: Readonly<Record<string, string>> = translations;

/** Display only: the engine keeps the original Oracle text and card identity. */
export function traditionalRulesText(text: string): string {
  return rules[text] ?? text;
}

export function displayRulesText(text: string): string {
  return isChineseCardLanguage() ? traditionalRulesText(text) : text;
}
