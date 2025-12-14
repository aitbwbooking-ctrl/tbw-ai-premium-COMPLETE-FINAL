import { useEffect, useState } from "react";

export default function LocationGate({ onGranted }) {
  const [status, setStatus] = useState("idle"); // idle | waiting | ok | fallback

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setStatus("fallback");
      onGranted({ mode: "DESKTOP_NO_GEO" });
      return;
    }

    setStatus("waiting");

    let resolved = false;

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      setStatus("fallback");
      onGranted({ mode: "APPROXIMATE" });
    }, 4000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        setStatus("ok");
        onGranted({
          mode: "PRECISE",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        setStatus("fallback");
        onGranted({ mode: "DENIED_OR_UNAVAILABLE" });
      },
      {
        enableHighAccuracy: false, // KLJUČNO za desktop
        timeout: 3000,
        maximumAge: 60000,
      }
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Lokacija</h3>
      <p>
        TBW koristi lokaciju za sigurnu navigaciju.
        Na desktopu može se koristiti i približna lokacija.
      </p>

      <button
        onClick={requestLocation}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 14,
          fontWeight: 900,
        }}
      >
        {status === "waiting" ? "Provjeravam lokaciju…" : "OMOGUĆI LOKACIJU"}
      </button>

      {status === "fallback" && (
        <p style={{ marginTop: 12, opacity: 0.8 }}>
          Koristi se približna lokacija (desktop način).
        </p>
      )}
    </div>
  );
}
