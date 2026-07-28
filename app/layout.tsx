import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://paper-guild-zh.akonya635.chatgpt.site"),
  title: "纸上百工｜水墨剪纸肉鸽",
  description: "清俊纸上旅人折纸而行，携十般百工器物走过二十四节气，在三路进化、合鸣与万器经纬中迎战双岁时 Boss。",
  openGraph: {
    title: "纸上百工｜水墨剪纸肉鸽",
    description: "人物与纸飞机自由折叠，十器三路成器，在二十四节气与万器经纬中迎战吞卷饕餮和岁夜年兽。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "纸上百工水墨剪纸世界" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "纸上百工｜水墨剪纸肉鸽",
    description: "十器三路成器，走遍二十四节气；击败年兽后展开万器经纬。",
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
      <body>{children}</body>
    </html>
  );
}
