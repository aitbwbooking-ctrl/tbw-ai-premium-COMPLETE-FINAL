import { useEffect, useRef, useState } from "react";

export default function App() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState([]);
  const [city, setCity] = useState(null);
  const [guests, setGuests] = useState(null);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef(null);

  /* ---------------------------
     CENTRALNI HANDLER (JEDINI!)
     --------------------------- */
  function handleUserText(text) {
    if (!text) return;

    const clean = text.toLowerCase().trim();
    setLog((l) => [...l, text]);

    // ---- prepoznavanje grada (OSNOVNO, STABILNO)
    const cities = ["zagreb", "beograd", "karlovac", "split", "rijeka", "osijek"];
    const foundCity = cities.find((c) => clean.includes(c));
    if (foundCity) {
      setCity(foundCity);
    }

    // ---- prepoznavanje broja osoba
    if (clean.includes("četiri") || clean.includes("4")) setGuests(4);
    if (clean.includes("dvoje") || clean.includes("2")) setGuests(2);

    // ---- booking intent
    const wantsBooking =
      clean.includes("smještaj") ||
      clean.includes("hotel") ||
      clean.includes("booking");

    // ---- AKCIJA
    if (wantsBooking && (foundCity || city)) {
      const finalCity = foundCity || city;
      openBooking(finalCity);
    }
  }

  /* ---------------------------
     BOOKING (NE DIRAM STIL)
     --------------------------- */
  function openBooking(cityName) {
    if (!cityName) return;
    const url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
      cityName
    )}`;
    window.open(url, "_blank");
  }

  /* ---------------------------
     MIKROFON (STABILNO)
     --------------------------- */
  function startMic() {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Speech recognition nije podržan.");
      return;
    }

    if (!recognitionRef.current) {
      const rec = new window.webkitSpeechRecognition();
      rec.lang = "hr-HR";
      rec.continuous = true;
      rec.interimResults = false;

      rec.onresult = (e) => {
        const t = e.results[e.results.length - 1][0].transcript;
        handleUserText(t);
      };

      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);

      recognitionRef.current = rec;
    }

    recognitionRef.current.start();
    setListening(true);
  }

  function stopMic() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  /* ---------------------------
     UI (OSTAJE JEDNOSTAVAN)
     --------------------------- */
  return (
    <div style={{ padding: 20 }}>
      <h1>TBW AI PREMIUM</h1>
      <h3>AI Safety Navigation</h3>

      <p>
        Status: {listening ? "🎤 Mic ON" : "⏸ Mic OFF"}
        {city && <> | 📍 City: {city}</>}
        {guests && <> | 👥 Guests: {guests}</>}
      </p>

      <div style={{ marginBottom: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Upiši ili govori"
        />
        <button onClick={() => handleUserText(input)}>SEND</button>
        {!listening ? (
          <button onClick={startMic}>🎤</button>
        ) : (
          <button onClick={stopMic}>⏹</button>
        )}
      </div>

      <ul>
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
  }
