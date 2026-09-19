import { useEffect, useRef } from 'react';
import { useModal } from '../context/ModalContext.jsx';

export default function Modal() {
  const { modal, closeModal } = useModal();
  const contentRef = useRef(null);

  useEffect(() => {
    if (!modal) return undefined;

    // Original main.js delayed the outside-click listener by 1s so the
    // click that opened the modal doesn't immediately close it.
    const timer = setTimeout(() => {
      function outsideClick(e) {
        if (contentRef.current && !contentRef.current.contains(e.target)) {
          closeModal();
        }
        e.stopPropagation();
      }
      document.addEventListener('click', outsideClick);
      // stash for cleanup
      timer.cleanup = () => document.removeEventListener('click', outsideClick);
    }, 1000);

    return () => {
      clearTimeout(timer);
      timer.cleanup?.();
    };
  }, [modal, closeModal]);

  return (
    <div id="modal" className="modal" style={{ display: modal ? 'block' : 'none' }}>
      {modal && (
        <div className="modal-content" id="modal_content" ref={contentRef}>
          <h4 className="modal_title">{modal.title}</h4>
          <p className="modal_text">{modal.text}</p>
          {modal.error && <p className="modal-error">{modal.error}</p>}
          <div className="modal-footer">
            <button onClick={closeModal} className="modal-button">
              Ok
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
