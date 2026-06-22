import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SmartNotificationsApp from './smart-notifications-app.component';

const Root: React.FC = () => (
  <BrowserRouter basename={window.getOpenmrsSpaBase()}>
    <Routes>
      <Route path="smart-notifications-app" element={<SmartNotificationsApp />} />
    </Routes>
  </BrowserRouter>
);

export default Root;
