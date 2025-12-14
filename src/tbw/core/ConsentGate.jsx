import { useEffect, useState } from "react";

export default function ConsentGate({ children }) {
  const [granted, setGranted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("tbw_consent_granted");
    if (saved === "true") {
      setGranted(true);
    }
  }, []);

  const requestConsent = async () => {
    try {
      // 🎤 MICROPHONE
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.getTracks().forEach(t => t.stop());

      // 📍 LOCATION
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          err => reject(err),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });

      // ✅ SVE USPJEŠNO → SPREMI
      localStorage.setItem("tbw_consent_granted", "true");
      setGranted(true);
    } catch (e) {
      console.error("TBW Consent error:", e);
      setError("Privole nisu odobrene. TBW ne može raditi bez dozvola.");
    }
  };

  if (granted) return children;

  return (
    <div className="consent-overlay">
      <div className="consent-box">
        <h2>TBW Safety Consent</h2>
        <p>
          TBW AI PREMIUM zahtijeva pristup:
          <br />• mikrofonu (glasovna asistencija)
          <br />• lokaciji (sigurnost, navigacija, alarmi)
        </p>
        <p>
          Bez ovih dozvola TBW ne može funkcionirati.
          Privolu možete povući u bilo kojem trenutku.
        </p>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button onClick={requestConsent}>
          OMOGUĆI I NASTAVI
        </button>
      </div>
    </div>
  );
}
