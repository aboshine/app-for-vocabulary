import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const font = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Korean Vocab",
  description: "Private Korean vocabulary flashcards with spaced repetition",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Korean", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f3ee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={font.className}>
        <div className="app">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
