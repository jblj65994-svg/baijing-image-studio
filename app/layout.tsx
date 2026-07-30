import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "白境工作台｜电商首饰图片制作",
  description: "专业抠图、实拍背景合成与电商主图导出。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
