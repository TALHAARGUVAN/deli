// frontend/src/components/Header.js
import React, { useState } from 'react';
import { Container, Navbar, Nav, Button, Dropdown, Modal, Form } from 'react-bootstrap';
import { useTitle } from '../contexts/TitleContext';

const Header = ({ isAdmin = false, activeUsers = [], onLogout, onAdminLogin, isLoggedIn = false, username = '' }) => {
  const { title, updateTitle, headerColor, updateHeaderColor } = useTitle();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [theme, setTheme] = useState('light');
  
  const handleTitleClick = () => {
    if (isAdmin) {
      const newTitle = prompt('Yeni başlık girin:', title);
      if (newTitle && newTitle.trim() !== '') {
        updateTitle(newTitle.trim());
      }
    }
  };

  const handleLogout = () => {
    if (window.confirm('Çıkış yapmak istediğinize emin misiniz?')) {
      localStorage.removeItem('isAdmin');
      if (onLogout) onLogout();
      
      // Sayfayı yeniden yükle
      window.location.href = '/';
    }
  };

  const handleSaveSettings = () => {
    // Ayarları kaydet
    setShowSettingsModal(false);
  };
  
  const handleAdminLogin = () => {
    // Admin şifresini kontrol et
    if (adminPassword === 'Tm2025!MusicApp#Admin') { // Güçlü şifre
      // Admin adı doğrudan ayarlanır
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('username', 'Admin');
      setShowAdminModal(false);
      setAdminPassword('');
      setAdminError('');
      
      // Admin paneline yönlendirme
      if (onAdminLogin) {
        onAdminLogin(); // Admin durumunu değiştirir
      }
    } else {
      setAdminError('Geçersiz şifre!');
    }
  };
  
  // Admin paneli butonuna tıklandığında bu fonksiyon çağrılacak
  const showAdminLoginModal = () => {
    // Eğer zaten admin olarak giriş yapılmışsa, doğrudan admin paneline yönlendir
    if (localStorage.getItem('isAdmin') === 'true') {
      if (onAdminLogin) onAdminLogin();
      return;
    }
    
    // Admin değilse modal göster
    setShowAdminModal(true);
  };
  
  const handleColorChange = (newColor) => {
    updateHeaderColor(newColor);
  };

  // Header arkaplan rengi için basit stil
  const headerStyle = {
    backgroundColor: headerColor,
    marginBottom: '1rem',
    color: 'white'
  };

  return (
    <>
      <div style={headerStyle}>
        <Navbar expand="lg" variant="dark" className="py-2">
          <Container className="d-flex">
            <Navbar.Brand 
              onClick={handleTitleClick}
              style={{ cursor: isAdmin ? 'pointer' : 'default' }}
            >
              {title} {isAdmin && <small className="text-muted">(Değiştirmek için tıklayın)</small>}
            </Navbar.Brand>
            
            <div className="ms-auto d-flex align-items-center">
              {/* Eğer giriş yapıldıysa kullanıcı adını göster */}
              {isLoggedIn && (
                <div className="text-light me-3">
                  <span>Hoşgeldin, {username}</span>
                </div>
              )}
              
              <div className="text-light me-3">
                <span title="Çevrimiçi Kullanıcılar">👤 {Array.isArray(activeUsers) ? activeUsers.length : 0}</span>
              </div>
              
              {isAdmin && (
                <div className="me-3">
                  <Form.Control
                    type="color"
                    value={headerColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    title="Header rengini seçin"
                  />
                </div>
              )}
              
              <Dropdown className="me-2">
                <Dropdown.Toggle variant="outline-light" id="menu-dropdown" size="sm">
                  MENÜ
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {!isAdmin && (
                    <Dropdown.Item onClick={showAdminLoginModal}>
                      Admin Paneli
                    </Dropdown.Item>
                  )}
                  <Dropdown.Item onClick={() => setShowSettingsModal(true)}>
                    {isAdmin ? 'Admin Ayarları' : 'Kullanıcı Ayarları'}
                  </Dropdown.Item>
                  {isAdmin && (
                    <Dropdown.Item onClick={handleLogout}>
                      Çıkış Yap
                    </Dropdown.Item>
                  )}
                </Dropdown.Menu>
              </Dropdown>
              
              {/* Eğer giriş yapılmışsa çıkış butonu göster */}
              {(isLoggedIn || isAdmin) && (
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={handleLogout}
                  title="Çıkış Yap"
                >
                  🚪
                </Button>
              )}
            </div>
          </Container>
        </Navbar>
      </div>
      
      {/* Ayarlar Modal */}
      <Modal show={showSettingsModal} onHide={() => setShowSettingsModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{isAdmin ? 'Admin Ayarları' : 'Kullanıcı Ayarları'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Kullanıcı Adı</Form.Label>
              <Form.Control 
                type="text" 
                placeholder="Kullanıcı adınız" 
                value={username}
                readOnly
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Tema</Form.Label>
              <Form.Select 
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="light">Açık</option>
                <option value="dark">Koyu</option>
              </Form.Select>
            </Form.Group>
            
            {isAdmin && (
              <Form.Group className="mb-3">
                <Form.Label>Admin Özellikleri</Form.Label>
                <Form.Check 
                  type="checkbox" 
                  label="Kullanıcıları yönet" 
                  defaultChecked 
                />
                <Form.Check 
                  type="checkbox" 
                  label="Duyuru yayınla" 
                  defaultChecked 
                />
              </Form.Group>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSettingsModal(false)}>
            İptal
          </Button>
          <Button variant="primary" onClick={handleSaveSettings}>
            Kaydet
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Admin Giriş Modal */}
      <Modal show={showAdminModal} onHide={() => {
        setShowAdminModal(false);
        setAdminPassword('');
        setAdminError('');
      }}>
        <Modal.Header closeButton>
          <Modal.Title>Admin Girişi</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Admin paneline erişmek için lütfen şifrenizi girin.
          </p>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Admin Şifresi</Form.Label>
              <Form.Control 
                type="password" 
                placeholder="Admin şifresi" 
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  setAdminError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdminLogin();
                  }
                }}
              />
              {adminError && <div className="text-danger mt-2">{adminError}</div>}
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowAdminModal(false);
            setAdminPassword('');
            setAdminError('');
          }}>
            İptal
          </Button>
          <Button variant="primary" onClick={handleAdminLogin}>
            Giriş Yap
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Header;