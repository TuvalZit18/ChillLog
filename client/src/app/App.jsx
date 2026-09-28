// Routes. Screens live in feature folders; filters live in the URL so views can be bookmarked.

import { Navigate, Route, Routes } from 'react-router';
import { FridgePage } from '../features/fridge/FridgePage.jsx';
import { OverviewPage } from '../features/overview/OverviewPage.jsx';
import { UploadPage } from '../features/upload/UploadPage.jsx';
import { AppShell } from '../shared/layout/AppShell.jsx';
import { Placeholder } from './Placeholder.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="fridges/:id" element={<FridgePage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="inspector" element={<Placeholder title="Inspector report" />} />
        <Route path="loggers" element={<Placeholder title="Loggers" />} />
        <Route path="loggers/:id" element={<Placeholder title="Logger" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
