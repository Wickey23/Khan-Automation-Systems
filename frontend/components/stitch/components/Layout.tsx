"use client";

import React from 'react';
import { usePathname } from "next/navigation";
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicPaths = ['/pricing', '/', '/solutions', '/case-studies', '/contact'];
  const isPublicPage = publicPaths.includes(pathname);

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <TopBar />
      <main className="ml-64 pt-16 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
