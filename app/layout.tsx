import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://paper-guild-zh.akonya635.chatgpt.site"),
  title: "纸上百工｜水墨剪纸肉鸽",
  description: "清俊纸上旅人折纸而行，携六般百工器物穿过惊蛰春桥、小暑荷塘、霜降稻埂与大寒岁市。",
  openGraph: {
    title: "纸上百工｜水墨剪纸肉鸽",
    description: "人物与纸飞机自由折叠，在四时绘卷中迎战吞卷饕餮与岁夜年兽。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "纸上百工水墨剪纸世界" }],
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
