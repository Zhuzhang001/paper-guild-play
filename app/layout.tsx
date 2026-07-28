import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "纸上百工｜轻量肉鸽生存",
  description: "操控纸上旅人，收集百工器物，在四时流转中完成一场八分钟的纸上冒险。",
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
