import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barber AI Booking",
  description: "Rezervări online, WhatsApp și AI pentru frizerii.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}