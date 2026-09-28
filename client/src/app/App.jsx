// Routes. Screens live in feature folders; filters live in the URL so views can be bookmarked.

import { Navigate, Route, Routes } from 'react-router';
import { FridgePage } from '../features/fridge/FridgePage.jsx';
import { InspectorPage } from '../features/inspector/InspectorPage.jsx';
import { LoggerPage } from '../features/loggers/LoggerPage.jsx';
import { LoggersPage } from '../features/loggers/LoggersPage.jsx';
import { OverviewPage } from '../features/overview/OverviewPage.jsx';
import { UploadPage } from '../features/upload/UploadPage.jsx';
import { AppShell } from '../shared/layout/AppShell.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="fridges/:id" element={<FridgePage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="inspector" element={<InspectorPage />} />
        <Route path="loggers" element={<LoggersPage />} />
        <Route path="loggers/:id" element={<LoggerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
