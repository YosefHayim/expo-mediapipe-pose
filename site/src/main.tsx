import "./landing/theme/tokens.css";
import { createRoot } from "react-dom/client";
import { LandingPage } from "./landing/landing-page";
import { applyInitialTheme } from "./landing/theme/use-theme";
import "./playground/style.css";

const root = document.getElementById("root");

const isRootMissing = root == null;
if (isRootMissing) throw new Error("Missing application root");

applyInitialTheme();
createRoot(root).render(<LandingPage />);
