import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../AuthProvider';
import { RequireAccess } from '../RequireAccess';
import { SettlementPage } from '../settlement/SettlementPage';
import { HaendlerAccount } from './HaendlerAccount';
import { HaendlerBookings } from './HaendlerBookings';
import { HaendlerLayout } from './HaendlerLayout';
import { HaendlerOverview } from './HaendlerOverview';

/** /haendler/* – nur lesen (Rolle haendler oder studio_admin). */
export default function HaendlerRoutes() {
  return (
    <AuthProvider>
      <RequireAccess area="haendler">
        <Routes>
          <Route element={<HaendlerLayout />}>
            <Route index element={<HaendlerOverview />} />
            <Route path="buchungen" element={<HaendlerBookings />} />
            <Route path="abrechnung" element={<SettlementPage />} />
            <Route path="konto" element={<HaendlerAccount />} />
            <Route path="*" element={<Navigate to="/haendler" replace />} />
          </Route>
        </Routes>
      </RequireAccess>
    </AuthProvider>
  );
}
