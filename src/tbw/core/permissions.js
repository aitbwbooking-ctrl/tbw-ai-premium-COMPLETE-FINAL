import { getFlag, setFlag } from "./storage";

const KEYS = {
  permOk: "tbw_perm_ok",
  permRemembered: "tbw_perm_remembered",
};

export async function ensurePermissions() {
  // LOCKED RULE: Location + Mic + Camera are mandatory for navigation.
  // We "remember" success per-device (localStorage) so we don't nag again.
  const remembered = getFlag(KEYS.permRemembered, false);
  const ok = getFlag(KEYS.permOk, false);
  if (remembered && ok) return { ok: true };

  // Location
  let locOk = false;
  try {
    await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        (e) => reject(e),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
    locOk = true;
  } catch {
    locOk = false;
  }

  // Mic + Camera (browser permission prompts)
  let micOk = false;
  let camOk = false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    micOk = stream.getAudioTracks().length > 0;
    camOk = stream.getVideoTracks().length > 0;
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    micOk = false;
    camOk = false;
  }

  const allOk = locOk && micOk && camOk;
  setFlag(KEYS.permOk, allOk);
  if (allOk) setFlag(KEYS.permRemembered, true);
  return { ok: allOk, locOk, micOk, camOk };
}

export function permissionsRememberedOk() {
  return getFlag(KEYS.permRemembered, false) && getFlag(KEYS.permOk, false);
}
