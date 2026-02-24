"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      theme="dark"
      richColors
      position="bottom-right"
      {...props}
    />
  );
};

export { Toaster };
