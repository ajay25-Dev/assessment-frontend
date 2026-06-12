import type { Metadata } from "next";
import { Suspense } from "react";
import { NavigationLoader } from "@/components/navigation-loader";
import { AppToaster } from "@/components/app-toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jora Assessment",
  description: "Assessment platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Suspense fallback={null}>
          <NavigationLoader />
        </Suspense>
        <AppToaster />
      </body>
    </html>
  );
}
