import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { GridView } from './grid/GridView';
import { ParentShell } from './parent/ParentShell';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GridView />} />
        <Route path="/parent/*" element={<ParentShell />} />
      </Routes>
    </BrowserRouter>
  );
}
