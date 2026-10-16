import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Мои проекты — Korney Kolokolnikov",
  description: "Загрузка сайтов, версии и ссылки для заказчиков.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
