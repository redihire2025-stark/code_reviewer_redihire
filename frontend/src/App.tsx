import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/Dashboard';
import { PRHistoryPage } from './pages/PRHistory';
import { AnalyticsPage } from './pages/Analytics';
import { DevInsightsPage } from './pages/DevInsights';
import './global.css';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/reviews" element={<PRHistoryPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/insights" element={<DevInsightsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
