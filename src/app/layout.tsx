// app/layout.tsx

import "./globals.css";
import { ReactNode } from "react";
import Navigation from "@/components/home/Navigation";
import Footer from "@/components/home/Footer";


export const metadata = {
  title: "OaZ",
  description: "OaZ의 소식과 프로젝트를 확인할 수 있는 데모 페이지입니다.",
  openGraph: {
    title: "OaZ",
    description: "OaZ의 소식과 프로젝트를 확인할 수 있는 데모 페이지입니다.",
  }};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white ">
        {/* 공통 배경 */}
        <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50 pointer-events-none" />
        <div className="fixed top-0 left-1/2 transform -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-r from-blue-50/50 via-purple-50/30 to-pink-50/50 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative">
          <div role="status" className="bg-amber-100 text-amber-950 text-center text-sm py-2">독립 데모 사이트입니다. 실제 학회 신청이나 운영 정보가 아닙니다.</div>
          <Navigation />
          <main className="relative z-10 pt-16 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
