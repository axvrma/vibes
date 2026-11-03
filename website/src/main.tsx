import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./styles/global.css";
import App from "./App";

const root = document.getElementById("root")!;
const application = (
  <StrictMode>
    <App />
  </StrictMode>
);
if (root.querySelector("main")) hydrateRoot(root, application);
else createRoot(root).render(application);
