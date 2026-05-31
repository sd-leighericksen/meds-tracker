import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { GridView } from './grid/GridView';
import { ParentShell } from './parent/ParentShell';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><GridView /></Layout>} />
        <Route path="/parent/*" element={<Layout><ParentShell /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="portrait-only fixed inset-0 z-50 items-center justify-center bg-canvas p-8 text-center">
        <RotatePrompt />
      </div>
      <div className="landscape-only min-h-screen w-full bg-canvas text-ink">
        {children}
      </div>
    </>
  );
}

function RotatePrompt() {
  return (
    <div className="flex max-w-md flex-col items-center gap-4">
      <div className="text-h2">Rotate to landscape</div>
      <p className="text-body-md text-slate">
        Meds Tracker is designed for a landscape touch screen.
      </p>
    </div>
  );
}
