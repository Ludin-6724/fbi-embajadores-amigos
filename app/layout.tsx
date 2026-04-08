import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import PWAProvider from "@/components/providers/PWAProvider";
import QueryProvider from "@/components/providers/QueryProvider";
import UpdateBanner from "@/components/providers/UpdateBanner";
import GlobalInstallPrompt from "@/components/ui/GlobalInstallPrompt";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FBI Embajadores Amigos",
  description: "Sitio oficial y compañero digital del taller 'DEL ALGORITMO AL AGENTE'",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#0A1128" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <QueryProvider>
          <PWAProvider>
            {children}
            <UpdateBanner />
            <GlobalInstallPrompt />
          </PWAProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
