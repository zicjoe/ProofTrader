import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App";
import { AppDataProvider } from "./providers/app-data-provider";
import { Toaster } from "./components/ui/sonner";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
      <AppDataProvider>
        <App />
        <Toaster position="top-right" />
      </AppDataProvider>
    </ThemeProvider>
  </React.StrictMode>
);
