"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      closeButton
      richColors
      expand={false}
      toastOptions={{
        duration: 4_000,
        classNames: {
          toast: "font-sans",
        },
      }}
    />
  );
}

export default ToastProvider;

