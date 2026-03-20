import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* Placeholder for /app and other routes */}
        <Route path="/app" element={<div className="p-20 text-center">App Dashboard Coming Soon</div>} />
        <Route path="/solutions" element={<div className="p-20 text-center">Solutions Page Coming Soon</div>} />
        <Route path="/pricing" element={<div className="p-20 text-center">Pricing Page Coming Soon</div>} />
        <Route path="/contact" element={<div className="p-20 text-center">Contact Page Coming Soon</div>} />
      </Routes>
    </Router>
  </React.StrictMode>
);
