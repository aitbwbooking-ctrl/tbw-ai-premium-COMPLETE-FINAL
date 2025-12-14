import { useEffect, useRef, useState } from "react";

export default function LocationGate({ onGranted }) {
  const doneRef = useRef(false);
  const [status, setStatus] = useState("idle"); // idle | working | done

  const finish = (payload) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setStatus("done");
    onGranted(payload);
  };

  const request = () => {
    setStatus("working");

    // ⏱ HARD FAILSAFE — NIKAD NE BLOKIRAJ
    setTimeout(() => {
      finish({ mode: "FALLBACK_NO_GEO" });
    }, 3500);

    if (!navigator.geolocation) {
      finish({ mode: "NO_GEO_API" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finish({
          mode: "OK",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      () => {
        finish({ mode: "DENIED_OR_UNAVAILABLE" });
      },
      {
        enableHighAccuracy: false,
        timeout: 2500,
        maximumAge: 60000,
      }
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Lokacija</h3>
      <p>
        TBW koristi lokaciju za sigurnu navigaciju.
        Ako lokacija nije dostupna, aplikacija će nastaviti u sigurnom načinu.
      </p>

      <button
        onClick={request}
        disabled={status === "working"}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 14,
          fontWeight: 900,
        }}
      >
        {status === "working" ? "Provjeravam…" : "OMOGUĆI LOKACIJU"}
      </button>
    </div>
  );
}

