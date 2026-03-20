import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import PricingPage from './pages/Pricing';
import Dashboard from './pages/app/Dashboard';
import ActivationPage from './pages/Activation';
import CaseStudiesPage from './pages/CaseStudies';
import SolutionsPage from './pages/Solutions';
import ContactPage from './pages/Contact';
import CallsPage from './pages/Calls';
import MessagesPage from './pages/Messages';
import AppointmentsPage from './pages/Appointments';
import LeadsPage from './pages/Leads';
import CustomersPage from './pages/Customers';
import OutreachPage from './pages/Outreach';
import BillingPage from './pages/Billing';
import SettingsPage from './pages/Settings';

import InfrastructurePage from './pages/Infrastructure';
import TeamPage from './pages/Team';
import UpgradePage from './pages/Upgrade';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<PricingPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="solutions" element={<SolutionsPage />} />
          <Route path="case-studies" element={<CaseStudiesPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="upgrade" element={<UpgradePage />} />
          
          {/* App Portal Routes */}
          <Route path="app">
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Navigate to="/app" replace />} />
            <Route path="activation" element={<ActivationPage />} />
            <Route path="calls" element={<CallsPage />} />
            <Route path="infrastructure" element={<InfrastructurePage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="outreach" element={<OutreachPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Legacy Redirects */}
          <Route path="dashboard" element={<Navigate to="/app" replace />} />
          <Route path="activation" element={<Navigate to="/app/activation" replace />} />
          <Route path="calls" element={<Navigate to="/app/calls" replace />} />
          <Route path="infrastructure" element={<Navigate to="/app/infrastructure" replace />} />
          <Route path="messages" element={<Navigate to="/app/messages" replace />} />
          <Route path="appointments" element={<Navigate to="/app/appointments" replace />} />
          <Route path="leads" element={<Navigate to="/app/leads" replace />} />
          <Route path="team" element={<Navigate to="/app/team" replace />} />
          <Route path="customers" element={<Navigate to="/app/customers" replace />} />
          <Route path="outreach" element={<Navigate to="/app/outreach" replace />} />
          <Route path="billing" element={<Navigate to="/app/billing" replace />} />
          <Route path="settings" element={<Navigate to="/app/settings" replace />} />

          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
