import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./style.css";

const root = document.getElementById("root");

const isRootMissing = !root;
if (isRootMissing) throw new Error("Missing application root");

createRoot(root).render(<App />);
