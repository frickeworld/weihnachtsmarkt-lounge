import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../AuthProvider';
import { RequireAccess } from '../RequireAccess';
import { SettlementPage } from '../settlement/SettlementPage';
import { AccessPage } from './AccessPage';
import { AdminLayout } from './AdminLayout';
import { BookingsPage } from './BookingsPage';
import { CalendarPage } from './CalendarPage';
import { DataCarePage } from './DataCarePage';
import { DayListPage } from './DayListPage';
import { WeekPlanPage } from './WeekPlanPage';
import { ExportPage } from './ExportPage';
import { NewBookingPage } from './NewBookingPage';
import { OverviewPage } from './OverviewPage';
import { SettingsPage } from './SettingsPage';

/** /admin/* – eigenes Bundle, nur für studio_admin mit 2FA. */
export default function AdminRoutes() {
  return (
    <AuthProvider>
      <RequireAccess area="admin">
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="buchungen" element={<BookingsPage />} />
            <Route path="neue-buchung" element={<NewBookingPage />} />
            <Route path="kalender" element={<CalendarPage />} />
            <Route path="einstellungen" element={<SettingsPage />} />
            <Route path="zugaenge" element={<AccessPage />} />
            <Route path="abrechnung" element={<SettlementPage />} />
            <Route path="export" element={<ExportPage />} />
            <Route path="datenpflege" element={<DataCarePage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
          <Route path="tagesliste/:date" element={<DayListPage />} />
          <Route path="belegungsplan/:from" element={<WeekPlanPage />} />
        </Routes>
      </RequireAccess>
    </AuthProvider>
  );
}
