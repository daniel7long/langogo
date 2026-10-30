// Arabic is written right to left. Spread this into the style of any text in the language being learned.
export const RTL_LANGS = ['ar'];
export const isRtl = (lang) => RTL_LANGS.includes(lang);
export const rtlText = (lang) => (isRtl(lang) ? { writingDirection: 'rtl' } : null);
