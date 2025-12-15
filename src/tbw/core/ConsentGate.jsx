import { useEffect, useState } from "react";

export default function ConsentGate({ children }) {
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("tbwConsent_v1");
    if (saved === "true") {
      setGranted(true);
    }
    setLoading(false);
  }, []);

  const requestConsent = async () => {
    try {
      // 1️⃣ MICROPHONE (browser permission)
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2️⃣ LOCATION (browser permission)
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });

      // 3️⃣ ✅ APP CONSENT (OVO JE KLJUČ)
      localStorage.setItem("tbwConsent_v1", "true");

      // 4️⃣ Aktivacija
      setGranted(true);

      // 5️⃣ Hard reload da TBWRuntime vidi consent
      setTimeout(() => {
        window.location.reload();
      }, 50);

    } catch (e) {
      alert(
        "TBW ne može raditi bez dozvole za mikrofon i lokaciju."
      );
    }
  };

  if (loading) return null;

  if (!granted) {
    return (
      <div style={styles.overlay}>
        <div style={styles.box}>
          <h1>TBW Safety Consent</h1>
          <p>
            TBW AI PREMIUM zahtijeva pristup:
            <br />• mikrofonu (glasovna asistencija)
            <br />• lokaciji (navigacija, sigurnost, alarmi)
          </p>
          <p>
            Bez ovih dozvola TBW ne može funkcionirati.
            Privolu možete povući u bilo kojem trenutku.
          </p>
          <button style={styles.btn} onClick={requestConsent}>
            OMOGUĆI I NASTAVI
          </button>
        </div>
      </div>
    );
  }

  return children;
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999
  },
  box: {
    background: "#fff",
    color: "#000",
    padding: 24,
    maxWidth: 420,
    borderRadius: 12,
    textAlign: "center"
  },
  btn: {
    marginTop: 20,
    padding: "14px 24px",
    fontSize: 16,
    fontWeight: "bold",
    background: "#00e676",
    border: "none",
    borderRadius: 8,
    cursor: "pointer"
  }
};

