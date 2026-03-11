import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { applyTheme, resolveInitialTheme } from "./shared/lib/theme";

applyTheme(resolveInitialTheme());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
