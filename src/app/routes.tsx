import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { LandingPage } from '../features/landing/LandingPage';
import { KioskContainer } from '../features/kiosk/KioskContainer';
import { NavigatorDashboard } from '../features/navigator/NavigatorDashboard';
import { DoctorDashboard } from '../features/doctor/DoctorDashboard';
import { AdminDashboard } from '../features/admin/AdminDashboard';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/kiosk" element={<KioskContainer />} />
      <Route path="/navigator" element={<NavigatorDashboard />} />
      <Route path="/doctor" element={<DoctorDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
};
