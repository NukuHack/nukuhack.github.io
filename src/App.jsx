import { lazy, Suspense } from 'react';
import { Route, Routes, BrowserRouter, Navigate } from 'react-router-dom';
import { ModalProvider } from './context/ModalContext.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';

import './styles/main.css';

const Dice = lazy(() => import('./pages/Dice.jsx'));
const Weather = lazy(() => import('./pages/Weather.jsx'));
const Extra = lazy(() => import('./pages/Extra.jsx'));
const Links = lazy(() => import('./pages/Links.jsx'));
const Subnet = lazy(() => import('./pages/Subnet.jsx'));
const Code = lazy(() => import('./pages/Code.jsx'));
const Video = lazy(() => import('./pages/Video.jsx'));
const DocumentPage = lazy(() => import('./pages/Document.jsx'));
const Navigator = lazy(() => import('./pages/Navigator.jsx'));
const Animation = lazy(() => import('./pages/Animation.jsx'));
const UrlTable = lazy(() => import('./pages/UrlTable.jsx'));
const Test3D = lazy(() => import('./pages/Test3D.jsx'));
const Convert = lazy(() => import('./pages/Convert.jsx'));

export default function App() {
  return (
    <BrowserRouter>
      <ModalProvider>
        <AppRoutes />
      </ModalProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/dice" element={<Dice />} />
          <Route path="/weather" element={<Weather />} />
          <Route path="/extra" element={<Extra />} />
          <Route path="/links" element={<Links />} />
          <Route path="/subnet" element={<Subnet />} />
          <Route path="/code" element={<Code />} />
          <Route path="/convert" element={<Convert />} />
          <Route path="/video" element={<Video />} />
          <Route path="/document" element={<DocumentPage />} />
          <Route path="/navigator" element={<Navigator />} />
          <Route path="/animation" element={<Animation />} />
          <Route path="/urltable" element={<UrlTable />} />
          <Route path="/test3d" element={<Test3D />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
