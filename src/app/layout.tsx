import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulso Social — Central de publicação",
  description: "Painel demonstrativo de publicação social em lote e métricas observadas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
