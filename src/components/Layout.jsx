import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import Modal from './Modal.jsx';

export default function Layout({Child}) {
  return (
    <>
      <Navbar />
      {typeof Child === 'function' ? <Child /> : <Outlet />}
      <Modal />
      <Footer />
    </>
  );
}
