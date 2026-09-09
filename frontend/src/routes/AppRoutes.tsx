import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PromotionalPage } from '../pages/Promotional/PromotionalPage';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../pages/Login/LoginPage';
import { DashboardPage } from '../pages/Dashboard/DashboardPage';
import { TasksPage } from '../pages/Tasks/TasksPage';
import { FamilyPage } from '../pages/Family/FamilyPage';
import { HealthPage } from '../pages/Health/HealthPage';
import { CareGraphPage } from '../pages/CareGraph/CareGraphPage';
import { SchedulerPage } from '../pages/Scheduler/SchedulerPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<PromotionalPage />} />
      <Route path="/promo" element={<PromotionalPage />} />
      <Route path="/promotional" element={<PromotionalPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/caregraph" element={<CareGraphPage />} />
        <Route path="/scheduler" element={<SchedulerPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
