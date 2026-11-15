import { createRoot } from "react-dom/client";
import { App } from "./playground/app";
import "./playground/style.css";

const root = document.getElementById("root");

const isRootMissing = root == null;
if (isRootMissing) throw new Error("Missing application root");

createRoot(root).render(<App />);
