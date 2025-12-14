/**
 * TBW InstallMode™
 * – jedinstveni engine za:
 *   mobile / tablet / in-car panel / PC
 * – isti safety rules
 */

export function detectInstallMode() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android auto") || ua.includes("car")) return "CAR_PANEL";
  if (ua.includes("tablet")) return "TABLET";
  if (ua.includes("mobile")) return "MOBILE";
  return "DESKTOP";
}

export function capabilities(mode) {
  switch (mode) {
    case "CAR_PANEL":
      return { backgroundAudio: true, bigUI: true };
    case "TABLET":
      return { backgroundAudio: true, splitView: true };
    case "DESKTOP":
      return { routePreview: true, analysis: true };
    default:
      return { basic: true };
  }
}
