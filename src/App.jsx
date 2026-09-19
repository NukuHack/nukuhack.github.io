import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import NotFound from './pages/NotFound.jsx';
import Home from './pages/Home.jsx';
import Dice from './pages/Dice.jsx';
import Weather from './pages/Weather.jsx';
import Extra from './pages/Extra.jsx';
import Links from './pages/Links.jsx';
import Subnet from './pages/Subnet.jsx';
import Code from './pages/Code.jsx';
import Markdown from './pages/Markdown.jsx';
import Video from './pages/Video.jsx';
import DocumentPage from './pages/Document.jsx';
import Navigator from './pages/Navigator.jsx';
import Animation from './pages/Animation.jsx';
import UrlTable from './pages/UrlTable.jsx';
import Test3D from './pages/Test3D.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dice" element={<Dice />} />
        <Route path="/weather" element={<Weather />} />
        <Route path="/extra" element={<Extra />} />
        <Route path="/links" element={<Links />} />
        <Route path="/subnet" element={<Subnet />} />
        <Route path="/code" element={<Code />} />
        <Route path="/markdown" element={<Markdown />} />
        <Route path="/video" element={<Video />} />
        <Route path="/document" element={<DocumentPage />} />
        <Route path="/navigator" element={<Navigator />} />
        <Route path="/animation" element={<Animation />} />
        <Route path="/urltable" element={<UrlTable />} />
        <Route path="/test3d" element={<Test3D />} />
        <Route path="*" element={<NotFound/>} />
      </Route>
    </Routes>
  );
}
