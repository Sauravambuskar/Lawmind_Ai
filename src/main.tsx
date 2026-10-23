import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startPerformanceMonitoring } from "@/lib/performance";

createRoot(document.getElementById("root")!).render(<App />);
startPerformanceMonitoring();
