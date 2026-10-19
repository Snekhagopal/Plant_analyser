import type { Metadata } from "next";
import { Caveat, Plus_Jakarta_Sans } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { PRODUCT_NAME, TAGLINE } from "@/lib/brand";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: `${TAGLINE}. Check plant health from a leaf or whole-plant photo: diseases for 14 crops, visible symptoms, pests and care advice.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${caveat.variable} antialiased`}>
      <body className="font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-forest-800 focus:px-4 focus:py-2">
          Skip to content
        </a>
        <Sidebar />
        <main id="main" className="min-h-dvh px-4 pb-12 pt-4 sm:px-6 lg:ml-60 lg:px-8 lg:pt-6">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </body>
    </html>
  );
}
