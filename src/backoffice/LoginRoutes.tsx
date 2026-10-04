import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthProvider';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage';
import { LoginPage } from './auth/LoginPage';
import { NewPasswordPage } from './auth/NewPasswordPage';
import { NoAccessPage } from './auth/NoAccessPage';
import { TwoFactorPage } from './auth/TwoFactorPage';

/** /login/* – wird erst beim Aufruf geladen (eigenes Bundle). */
export default function LoginRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route index element={<LoginPage />} />
        <Route path="passwort-vergessen" element={<ForgotPasswordPage />} />
        <Route path="neues-passwort" element={<NewPasswordPage />} />
        <Route path="2fa" element={<TwoFactorPage />} />
        <Route path="kein-zugang" element={<NoAccessPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
