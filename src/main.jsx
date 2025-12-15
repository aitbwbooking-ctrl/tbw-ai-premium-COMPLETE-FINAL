import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// TBW Runtime (side-effect, pokreće se sam)
import "./tbw/runtime/TBWRuntime";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

