import { readStore, writeStore } from "./storage";

export const TBW_LANGS = ["en", "hr", "de", "it", "fr", "es", "zh", "ja"]; // locked
export const TBW_DEFAULT_LANG = "en";

const STRINGS = {
  en: {
    TBW_EMERGENCY_PULT: "TBW EMERGENCY PULT",
    TBW_TEMP_OFF: "TBW is temporarily turning off. If you want to reactivate, just say 'Hey TBW' and I’m at your service. Kind regards.",
    PERM_REQUIRED_TITLE: "Permissions required",
    PERM_REQUIRED_BODY: "TBW Navigation cannot work without Location, Microphone and Camera.",
    PERM_LOCATION_BLOCK: "NEMOGUĆNOST KORIŠTENJA TBW NAVIGACIJE BEZ LOKACIJE",
    PERM_ENABLE: "Enable",
    EXIT: "Exit",
    CONTINUE: "Continue",
    ACCEPT: "Accept",
  },
  hr: {
    TBW_EMERGENCY_PULT: "TBW EMERGENCY PULT",
    TBW_TEMP_OFF: "TBW se privremeno isključuje. U slučaju ponovne aktivacije, recite samo 'Hey TBW' i stojim vam na raspolaganju. Lijepi pozdrav.",
    PERM_REQUIRED_TITLE: "Potrebne privole",
    PERM_REQUIRED_BODY: "TBW Navigacija ne može raditi bez Lokacije, Mikrofona i Kamere.",
    PERM_LOCATION_BLOCK: "NEMOGUĆNOST KORIŠTENJA TBW NAVIGACIJE BEZ LOKACIJE",
    PERM_ENABLE: "Omogući",
    EXIT: "Izlaz",
    CONTINUE: "Nastavi",
    ACCEPT: "Prihvaćam",
  },
  // ostali jezici: fallback na en (do prijevoda), ali jezik lista je zaključana
};

export function getDeviceLang() {
  const nav = (navigator.language || "en").toLowerCase();
  const base = nav.split("-")[0];
  return TBW_LANGS.includes(base) ? base : TBW_DEFAULT_LANG;
}

export function getLang() {
  const s = readStore();
  const lang = s.tbwLang || getDeviceLang();
  return TBW_LANGS.includes(lang) ? lang : TBW_DEFAULT_LANG;
}

export function setLang(lang) {
  if (!TBW_LANGS.includes(lang)) return getLang();
  writeStore({ tbwLang: lang });
  return lang;
}

export function t(key) {
  const lang = getLang();
  const dict = STRINGS[lang] || STRINGS.en;
  return dict[key] || (STRINGS.en[key] || key);
}

