import React from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../api/auth';

const ProtectedRoute = ({ children }) => {
  if (!authService.isAuthenticated()) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" replace />;
  }

  // Render the protected content if authenticated
  return children;
};

export default ProtectedRoute;
