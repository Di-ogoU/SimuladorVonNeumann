import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visualizador interactivo de arquitectura Von Neumann",
  description:
    "Simulacion conceptual del transporte de instrucciones y datos entre CPU, memoria, buses y dispositivos de entrada/salida.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
