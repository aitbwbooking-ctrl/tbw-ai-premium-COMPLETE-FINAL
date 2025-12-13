import { duckAudioStart, duckAudioEnd } from "./audio";
import { getLang } from "./i18n";

export function speak(text, { priority = "normal" } = {}) {
  return new Promise((resolve) => {
    try {
      if (priority === "critical") duckAudioStart();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = getLang();
      u.onend = () => {
        if (priority === "critical") duckAudioEnd();
        resolve(true);
      };
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      resolve(false);
    }
  });
}

export function makeRecognizer({ continuous = true } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = getLang();
  r.continuous = continuous;
  r.interimResults = true;
  r.maxAlternatives = 1;
  return r;
}
