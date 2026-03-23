/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Calls } from './pages/Calls';
import { Leads } from './pages/Leads';
import { Appointments } from './pages/Appointments';
import { Messages } from './pages/Messages';
import { Settings } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';
import { Outreach } from './pages/Outreach';
import { Billing } from './pages/Billing';
import { Team } from './pages/Team';
import { AdminOrgs } from './pages/AdminOrgs';
import { AdminOrgDetail } from './pages/AdminOrgDetail';
import { AdminTestingLab } from './pages/AdminTestingLab';
import { AdminSystemHealth } from './pages/AdminSystemHealth';
import { AdminEvents } from './pages/AdminEvents';
import { AdminReports } from './pages/AdminReports';
import { AdminDemo } from './pages/AdminDemo';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminCalls } from './pages/AdminCalls';
import { AdminMessages } from './pages/AdminMessages';
import { AdminLeads } from './pages/AdminLeads';
import { Analytics } from './pages/Analytics';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Client Routes */}
        <Route path="/app" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="calls" element={<Calls />} />
          <Route path="leads" element={<Leads />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="messages" element={<Messages />} />
          <Route path="settings" element={<Settings />} />
          <Route path="onboarding" element={<Onboarding />} />
          <Route path="outreach" element={<Outreach />} />
          <Route path="billing" element={<Billing />} />
          <Route path="team" element={<Team />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<MainLayout isAdmin />}>
          <Route index element={<AdminDashboard />} />
          <Route path="orgs" element={<AdminOrgs />} />
          <Route path="orgs/:id" element={<AdminOrgDetail />} />
          <Route path="orgs/:id/testing" element={<AdminTestingLab />} />
          <Route path="calls" element={<AdminCalls />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="system" element={<AdminSystemHealth />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="demo" element={<AdminDemo />} />
        </Route>

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/app" replace />} />
      </Routes>
    </Router>
  );
}
