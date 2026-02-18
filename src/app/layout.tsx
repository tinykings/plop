import type { Metadata, Viewport } from "next";
import { Syne, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { NoteProvider } from "@/context/NoteContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SettingsProvider } from "@/context/SettingsContext";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const basePath = process.env.NODE_ENV === 'production' ? '/plop' : '';

export const metadata: Metadata = {
  title: "plop",
  description: "github notes",
  manifest: `${basePath}/manifest.json`,
  icons: {
    icon: `${basePath}/icon-180.png`,
    apple: `${basePath}/icon-180.png`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "plop",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EBE9E4" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0D0D" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${syne.variable} ${spaceGrotesk.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <ThemeProvider>
          <SettingsProvider>
            <NoteProvider>
              {children}
            </NoteProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
