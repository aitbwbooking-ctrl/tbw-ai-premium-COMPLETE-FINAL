/**
 * TBW Auto-Resolve™
 * – spaja vrijeme + rutu + booking
 * – aktivira se kad prijeti kašnjenje ili nesigurnost
 */

export function shouldAutoResolve({ weatherRisk, etaDriftMin }) {
  return weatherRisk === true || etaDriftMin >= 20;
}

export function proposeSolution({ destination, preference }) {
  if (preference === "STAY_ON_PLAN") {
    return {
      action: "CONTINUE",
      message: "Nastavljamo prema originalnoj destinaciji uz pojačan safety nadzor.",
    };
  }
  return {
    action: "ADJUST",
    message: "Predlažem sigurnu alternativu ili privremeni smještaj u blizini.",
  };
}
