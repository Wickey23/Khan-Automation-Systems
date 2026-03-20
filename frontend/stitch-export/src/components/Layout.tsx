import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function Layout() {
  const location = useLocation();
  const publicPaths = ['/pricing', '/', '/solutions', '/case-studies', '/contact'];
  const isPublicPage = publicPaths.includes(location.pathname);

  if (isPublicPage) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <TopBar />
      <main className="ml-64 pt-16 min-h-screen">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
