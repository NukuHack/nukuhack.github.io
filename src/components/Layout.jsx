import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import Modal from './Modal.jsx';

export default function Layout() {
  return (
    <>
      <Navbar />
      <Outlet />
      <Modal />
      <Footer />
    </>
  );
}
