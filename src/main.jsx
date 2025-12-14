import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// ⬇️ OVO JE KLJUČNO – bez ovoga TBW NE POSTOJI
import "./tbw/core/TBWBootstrap";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
