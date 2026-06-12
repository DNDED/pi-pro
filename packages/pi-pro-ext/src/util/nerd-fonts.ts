export function detectNerdFontsFromEnv(env: Record<string, string | undefined>): boolean {
  if (env.PROMYRA_NERD_FONTS === "0" || env.PROMYRA_NERD_FONTS === "false") return false;
  if (env.PROMYRA_NERD_FONTS === "1" || env.PROMYRA_NERD_FONTS === "true") return true;
  const term = (env.TERM ?? "").toLowerCase();
  const termProgram = (env.TERM_PROGRAM ?? "").toLowerCase();
  const fontName = (env.FONT_NAME ?? "").toLowerCase();
  const indicators = ["nerd", "nfont", "meslo", "jetbrainsmono nf", "fira code nf", "cascadia code nf"];
  if (indicators.some((i) => term.includes(i))) return true;
  if (indicators.some((i) => termProgram.includes(i))) return true;
  if (indicators.some((i) => fontName.includes(i))) return true;
  return false;
}

export function detectNerdFonts(): boolean {
  return detectNerdFontsFromEnv({ ...process.env });
}
