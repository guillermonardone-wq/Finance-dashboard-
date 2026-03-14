import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Racing Coach",
  description:
    "Phone-first post-session racing coach. Analyze your driving, get corner-by-corner coaching.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <a href="/" className="flex items-center gap-2">
                <span className="text-xl font-bold text-racing-400">
                  Racing Coach
                </span>
                <span className="badge-green text-[10px]">MVP</span>
              </a>
              <div className="flex items-center gap-4">
                <a
                  href="/sessions"
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Sessions
                </a>
                <a
                  href="/sessions/new"
                  className="btn-primary text-sm py-1.5 px-3"
                >
                  New Session
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
