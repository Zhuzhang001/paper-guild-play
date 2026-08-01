import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://paper-guild-zh.akonya635.chatgpt.site"),
  title: "纸上百工｜水墨剪纸肉鸽",
  description:
    "只需移动，在二十四节气中拿到、做细、改法、再磨并定型十般百工器物；进入无尽后以器盘、45种合器与三层百工谱迎战天变。",
  openGraph: {
    title: "纸上百工｜水墨剪纸肉鸽",
    description:
      "人物与纸飞机可逆折叠，十器三种改法、45种合器，在二十四节气与无尽器盘中迎战各有所长的敌群与班主。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "纸上百工水墨剪纸世界" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "纸上百工｜水墨剪纸肉鸽",
    description:
      "十器三种改法，走遍二十四节气；击败年兽后展开器盘、45种合器、天变与三层百工谱。",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="preload"
          href="/fonts/LXGWWenKaiScreen-Game.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/MaShanZheng-Game.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
