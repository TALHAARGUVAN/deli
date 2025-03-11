// frontend/src/components/LoginPage.js
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { useTitle } from '../contexts/TitleContext';

const ENDPOINT = 'http://localhost:5000';
let socket;

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginType, setLoginType] = useState('guest'); // guest, user, admin
  const [error, setError] = useState('');
  const [title, setPageTitle] = useState('Müzik İstek Platformu');
  const { updateTitle } = useTitle();
  const navigate = useNavigate();

  // Socket.io bağlantısını kur ve başlığı al
  useEffect(() => {
    socket = io(ENDPOINT);
    
    // Başlık bilgisini al
    socket.on('initialState', ({ title }) => {
      if (title) {
        setPageTitle(title);
        updateTitle(title);
      }
    });

    // Başlık güncellendiğinde
    socket.on('updateTitle', (newTitle) => {
      setPageTitle(newTitle);
      updateTitle(newTitle);
    });

    return () => {
      socket.disconnect();
    };
  }, [updateTitle]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Kullanıcı adı gerekli');
      return;
    }

    // Admin girişi kontrolü
    if (loginType === 'admin') {
      // Gerçek bir uygulamada burada backend API'sine istek atılır
      // Basitlik için şimdilik basit bir kontrol yapıyoruz
      if (password === 'admin123') { // Örnek şifre - gerçek uygulamada bu tür kontrolü backend'de yapın
        localStorage.setItem('username', username);
        localStorage.setItem('userType', 'admin');
        navigate('/admin');
      } else {
        setError('Geçersiz admin şifresi');
      }
      return;
    }

    // Üye girişi kontrolü
    if (loginType === 'user') {
      // Gerçek bir uygulamada burada backend API'sine istek atılır
      // Basitlik için şimdilik basit bir kontrol yapıyoruz
      if (password === 'user123') { // Örnek şifre - gerçek uygulamada bu tür kontrolü backend'de yapın
        localStorage.setItem('username', username);
        localStorage.setItem('userType', 'user');
        navigate('/user');
      } else {
        setError('Geçersiz kullanıcı şifresi');
      }
      return;
    }

    // Misafir girişi
    localStorage.setItem('username', username);
    localStorage.setItem('userType', 'guest');
    navigate('/user');
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{minHeight: "100vh"}}>
      <Card className="shadow-lg" style={{maxWidth: "500px", width: "100%"}}>
        <Card.Header className="text-center bg-primary text-white py-3">
          <h2>{title}</h2>
        </Card.Header>
        <Card.Body className="p-4">
          <div className="text-center mb-4">
            <Button 
              variant={loginType === 'guest' ? 'primary' : 'outline-primary'} 
              className="me-2"
              onClick={() => setLoginType('guest')}
            >
              Misafir Giriş
            </Button>
            <Button 
              variant={loginType === 'user' ? 'primary' : 'outline-primary'} 
              className="me-2"
              onClick={() => setLoginType('user')}
            >
              Üye Giriş
            </Button>
            <Button 
              variant={loginType === 'admin' ? 'primary' : 'outline-primary'}
              onClick={() => setLoginType('admin')}
            >
              Admin Giriş
            </Button>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Kullanıcı Adı</Form.Label>
              <Form.Control
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Kullanıcı adınızı girin"
                required
              />
            </Form.Group>

            {(loginType === 'user' || loginType === 'admin') && (
              <Form.Group className="mb-3">
                <Form.Label>Şifre</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi girin"
                  required
                />
              </Form.Group>
            )}

            <Button variant="primary" type="submit" className="w-100 mt-3 py-2">
              {loginType === 'guest' ? 'Misafir Olarak Giriş Yap' : 
               loginType === 'user' ? 'Üye Girişi Yap' : 'Admin Girişi Yap'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default LoginPage;