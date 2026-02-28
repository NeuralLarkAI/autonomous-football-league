"use client";

import { Toaster } from "react-hot-toast";

export function ToasterProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: "rgba(15, 23, 42, 0.95)",
          color: "#e2e8f0",
          border: "1px solid rgba(148, 163, 184, 0.18)",
        },
      }}
    />
  );
}

