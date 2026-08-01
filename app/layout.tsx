import type { Metadata, Viewport } from "next";
import { BUILD_INFO, publicAsset } from "./publicAsset";
import "./globals.css";

const siteOrigin =
  process.env.NEXT_PUBLIC_SITE_ORIGIN ??
  "https://paper-guild-zh.akonya635.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  applicationName: "纸上百工",
  title: "纸上百工｜水墨剪纸肉鸽",
  description:
    "只需移动，在二十四节气中拿到、做细并定型十般百工器物；击败年兽后展开器盘与无尽合器。",
  manifest: publicAsset("/manifest.webmanifest"),
  robots: { index: false, follow: false, nocache: true },
  icons: {
    icon: [
      { url: publicAsset("/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: publicAsset("/icon.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: publicAsset("/icon-192.png"), sizes: "192x192" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "纸上百工",
  },
  openGraph: {
    type: "website",
    title: "纸上百工｜水墨剪纸肉鸽",
    description:
      "人物与纸飞机可逆折叠，十器三种改法，在二十四节气与无尽器盘中迎战各有所长的敌群。",
    images: [
      {
        url: publicAsset("/og.png"),
        width: 1200,
        height: 630,
        alt: "纸上百工水墨剪纸世界",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "纸上百工｜水墨剪纸肉鸽",
    description: "十器三种改法，走遍二十四节气；击败年兽后展开无尽器盘。",
    images: [publicAsset("/og.png")],
  },
  other: {
    "paper-guild-build": BUILD_INFO.version,
    "paper-guild-test": "non-commercial",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#243c37",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const regularFont = publicAsset("/fonts/LXGWWenKaiScreen-Game.woff2");
  const titleFont = publicAsset("/fonts/MaShanZheng-Game.woff2");
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="preload"
          href={regularFont}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href={titleFont}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <style>{`
          @font-face {
            font-family: "Paper Guild Text";
            src: url("${regularFont}") format("woff2");
            font-style: normal;
            font-weight: 400 700;
            font-display: swap;
          }
          @font-face {
            font-family: "Paper Guild Display";
            src: url("${titleFont}") format("woff2");
            font-style: normal;
            font-weight: 400;
            font-display: swap;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
