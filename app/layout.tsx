import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-interface", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const image = `${origin}/og.png`;

  return {
    metadataBase: new URL(origin),
    title: "RoboDSR Twin — Living Healthcare Spatial Intelligence",
    description: "Interactive 3D proposal demonstration for a living, site-specific healthcare digital twin.",
    openGraph: {
      title: "RoboDSR Twin",
      description: "The healthcare center as one intelligent system.",
      type: "website",
      images: [{ url: image, width: 1730, height: 909, alt: "Physical healthcare site paired with its living digital twin" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "RoboDSR Twin",
      description: "A living healthcare-center digital twin, embodied.",
      images: [image],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
