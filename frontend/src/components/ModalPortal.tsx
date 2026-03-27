import React from 'react';
import {createPortal} from 'react-dom';

export default function ModalPortal({children}: {children: React.ReactNode}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

