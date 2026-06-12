import type { Metadata } from "next";
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
        <NavigationLoader />
        <AppToaster />
      </body>
    </html>
  );
}
