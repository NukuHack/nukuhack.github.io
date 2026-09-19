import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null); // { title, text, error } | null

  const openModal = useCallback((title, text = 'Unexpected error occurred!', error) => {
    setModal({ title, text, error });
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  const value = useMemo(() => ({ modal, openModal, closeModal }), [modal, openModal, closeModal]);

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

/** Equivalent of calling ModalOpen(title, text, error) / ModalClose() */
export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within a ModalProvider');
  return ctx;
}
