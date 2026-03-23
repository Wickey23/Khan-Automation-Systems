import React from 'react';
import { Sidebar, Header } from './Layout';
import { Outlet } from 'react-router-dom';

export const MainLayout: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-background-light">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
