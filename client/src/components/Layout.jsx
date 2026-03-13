import React from 'react';

const Layout = ({ children }) => {
  return (
    <div className="max-w-[1280px] mx-auto w-full min-h-screen px-4">
      {children}
    </div>
  );
};

export default Layout;
