import { useEffect, useState } from "react";

export default function ConsentGate({ children }) {
  const [granted, setGranted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("tbw_consent_granted");
    if (saved === "true") {
      setGranted(true);
    }
  }, []);

  const requestConsent = async () => {
    try {
      // 🎙 MICROPHONE
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // 📍 LOCATION
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      localStorage.setItem("tbw_consent_granted", "true");
      setGranted(true);
    } catch (e) {
      console.error(e);
      setError(
        "TBW ne može raditi bez mikrofona i lokacije. Privole su obavezne."
      );
    }
  };

  if (granted) {
    return children;
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.box}>
        <h2 style={{ marginBottom: 12 }}>TBW Safety Consent</h2>

        <p style={styles.text}>
          TBW AI PREMIUM zahtijeva pristup:
          <br />• mikrofonu (glasovna asistencija)
          <br />• lokaciji (sigurnost, navigacija, alarmi)
        </p>

        <p style={styles.small}>
          Privole su obavezne. Bez njih TBW ne može funkcionirati.
          <br />
          Privolu možete povući u bilo kojem trenutku.
        </p>

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} onClick={requestConsent}>
          OMOGUĆI I NASTAVI
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  box: {
    background: "#0b0f1a",
    padding: 24,
    borderRadius: 14,
    maxWidth: 420,
    width: "90%",
    textAlign: "center",
    boxShadow: "0 0 40px rgba(0,255,180,0.2)",
  },
  text: {
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 12,
  },
  small: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 16,
  },
  error: {
    color: "#ff5b5b",
    fontSize: 13,
    marginBottom: 10,
  },
  button: {
    background: "linear-gradient(135deg,#00ffb3,#00c18c)",
    border: "none",
    color: "#000",
    padding: "12px 18px",
    borderRadius: 10,
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%",
  },
};
