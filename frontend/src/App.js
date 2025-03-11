// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import UserPanel from './components/UserPanel';
import AdminPanel from './components/AdminPanel';
import { TitleProvider } from './contexts/TitleContext';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  // Sayfa yüklendiğinde localStorage kontrol edilir
  useEffect(() => {
    // Bu değer localStorage'dan okunur
    const adminStatus = localStorage.getItem('isAdmin') === 'true';
    console.log("Admin durumu:", adminStatus);
    
    // Eğer admin olarak işaretlendiyse
    if (adminStatus) {
      // Kullanıcı adı her zaman Admin olmalı
      localStorage.setItem('username', 'Admin');
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  }, []); // Sadece ilk yüklemede çalışır

  // Admin girişi
  const handleAdminLogin = () => {
    // Admin girişi yapıldığında
    localStorage.setItem('isAdmin', 'true');
    localStorage.setItem('username', 'Admin');
    setIsAdmin(true);
  };

  // Admin çıkışı
  const handleAdminLogout = () => {
    // Admin çıkışı yapıldığında
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('username');
    setIsAdmin(false);
  };

  return (
    <TitleProvider>
      {isAdmin ? (
        <AdminPanel onLogout={handleAdminLogout} />
      ) : (
        <UserPanel onAdminLogin={handleAdminLogin} />
      )}
    </TitleProvider>
  );
}

export default App;