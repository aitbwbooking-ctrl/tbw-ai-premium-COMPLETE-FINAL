import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ConsentGate from "./tbw/core/ConsentGate";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConsentGate>
      <App />
    </ConsentGate>
  </React.StrictMode>
);
