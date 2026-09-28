// Routes. Screens live in feature folders; filters live in the URL so views can be bookmarked.

import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from '../shared/layout/AppShell.jsx';
import { Placeholder } from './Placeholder.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Placeholder title="Every fridge, this week" />} />
        <Route path="upload" element={<Placeholder title="Upload files" />} />
        <Route path="inspector" element={<Placeholder title="Inspector report" />} />
        <Route path="loggers" element={<Placeholder title="Loggers" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
