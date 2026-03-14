import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Edge – Prediction Market Dashboard",
  description:
    "Scan prediction markets for mispriced events using dislocation scores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
            <a href="/" className="font-bold text-lg tracking-tight">
              <span className="text-indigo-400">Event</span>
              <span className="text-white">Edge</span>
            </a>
            <a
              href="/markets"
              className="text-sm text-gray-400 hover:text-white transition"
            >
              All Markets
            </a>
            <a
              href="/flagged"
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Flagged
            </a>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
