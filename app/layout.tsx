import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { preload } from "react-dom";
import "./globals.css";
import { GuestBanner } from "@/components/ui/GuestBanner";
import { isGuest } from "@/lib/guest";

export const metadata: Metadata = {
  title: "myKx",
  description: "Every student gets a sidekick: Kix.",
};

export const viewport: Viewport = {
  themeColor: "#1E1C45",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Body text and the default pack's display face; other pack fonts load on first use.
  preload("/fonts/Nunito-latin.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  preload("/fonts/Fredoka-latin.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });

  return (
    <html lang="en-SG">
      <body>
        {children}
        {/* The guest site only (lib/guest.ts): every page says AI is off and replies are samples. */}
        {isGuest() && (
          <Suspense fallback={null}>
            <GuestBanner />
          </Suspense>
        )}
      </body>
    </html>
  );
}
