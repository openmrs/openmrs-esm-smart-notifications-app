import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NotificationInbox from './components/notification-inbox/notification-inbox.component';

const Root: React.FC = () => (
  <BrowserRouter basename={window.getOpenmrsSpaBase()}>
    <Routes>
      <Route path="smart-notifications" element={<NotificationInbox />} />
    </Routes>
  </BrowserRouter>
);

export default Root;
