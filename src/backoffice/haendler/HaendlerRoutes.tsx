import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../AuthProvider';
import { RequireAccess } from '../RequireAccess';
import { SettlementPage } from '../settlement/SettlementPage';
import { NewBookingPage } from '../admin/NewBookingPage';
import { HaendlerAccount } from './HaendlerAccount';
import { HaendlerBookings } from './HaendlerBookings';
import { HaendlerGiveaway } from './HaendlerGiveaway';
import { HaendlerLayout } from './HaendlerLayout';
import { HaendlerOverview } from './HaendlerOverview';

/** /haendler/* – Rolle haendler oder studio_admin: lesen, kostenlose Buchungen, Abrechnung, Export. */
export default function HaendlerRoutes() {
  return (
    <AuthProvider>
      <RequireAccess area="haendler">
        <Routes>
          <Route element={<HaendlerLayout />}>
            <Route index element={<HaendlerOverview />} />
            <Route path="buchungen" element={<HaendlerBookings />} />
            <Route path="neue-buchung" element={<NewBookingPage area="haendler" />} />
            <Route path="gewinnspiel" element={<HaendlerGiveaway />} />
            <Route path="abrechnung" element={<SettlementPage />} />
            <Route path="konto" element={<HaendlerAccount />} />
            <Route path="*" element={<Navigate to="/haendler" replace />} />
          </Route>
        </Routes>
      </RequireAccess>
    </AuthProvider>
  );
}
