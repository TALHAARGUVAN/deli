import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Button, Form, Container, Row, Col, Card } from 'react-bootstrap';

const ENDPOINT = 'http://localhost:5000';
let socket;

const UserPanel = () => {
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [songRequest, setSongRequest] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [volume, setVolume] = useState(50);
  
  const messagesEndRef = useRef(null);

  // Socket.io bağlantısını kur
  useEffect(() => {
    socket = io(ENDPOINT);
    
    // Bağlantı başarılı olduğunda
    socket.on('connect', () => {
      console.log('Socket.io bağlantısı kuruldu!');
    });

    // Başlangıç durumunu al
    socket.on('initialState', ({ currentSong, activeUsers }) => {
      if (currentSong) setCurrentSong(currentSong);
      setActiveUsers(activeUsers);
    });

    // Aktif kullanıcılar güncellendiğinde
    socket.on('updateActiveUsers', (users) => {
      setActiveUsers(users);
    });

    // Yeni sohbet mesajı geldiğinde
    socket.on('newChatMessage', (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    // Çalan şarkı güncellendiğinde
    socket.on('updateCurrentSong', (song) => {
      setCurrentSong(song);
    });

    // Bağlantı kapandığında temizle
    return () => {
      socket.disconnect();
    };
  }, []);

  // Mesajlar güncellendiğinde otomatik olarak aşağı kaydır
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Kullanıcı girişi
  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      socket.emit('setUsername', username);
      setIsLoggedIn(true);
    }
  };

  // Şarkı isteği gönder
  const handleSongRequest = (e) => {
    e.preventDefault();
    if (songRequest.trim()) {
      socket.emit('requestSong', songRequest);
      setSongRequest('');
    }
  };

  // Sohbet mesajı gönder
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      socket.emit('chatMessage', chatMessage);
      setChatMessage('');
    }
  };

  // Ses seviyesini değiştir
  const handleVolumeChange = (e) => {
    setVolume(e.target.value);
  };

  // Kullanıcı henüz giriş yapmadıysa login ekranını göster
  if (!isLoggedIn) {
    return (
      <Container className="d-flex align-items-center justify-content-center" style={{minHeight: "100vh"}}>
        <Card className="shadow-sm" style={{maxWidth: "400px", width: "100%"}}>
          <Card.Body className="p-4">
            <h2 className="text-center mb-4">Müzik İstek Platformu</h2>
            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3">
                <Form.Label>Kullanıcı Adınız</Form.Label>
                <Form.Control
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Kullanıcı adınızı girin"
                  required
                />
              </Form.Group>
              <Button variant="primary" type="submit" className="w-100">
                Giriş Yap
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Row>
        {/* Sol Panel: Şarkı bilgisi ve istek formu */}
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Çalan Şarkı</Card.Title>
              {currentSong ? (
                <div className="mb-3 p-3 bg-light rounded">
                  <p className="fw-bold mb-1">{currentSong.song}</p>
                  <p className="text-muted small">İsteyen: {currentSong.requestedBy}</p>
                </div>
              ) : (
                <p className="text-muted">Şu anda çalan şarkı yok</p>
              )}

              <div className="mb-3">
                <Form.Label>Ses Seviyesi: {volume}%</Form.Label>
                <Form.Range
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                />
              </div>
              
              <Card.Title>Şarkı İsteği</Card.Title>
              <Form onSubmit={handleSongRequest}>
                <Form.Group className="mb-3">
                  <Form.Control
                    type="text"
                    value={songRequest}
                    onChange={(e) => setSongRequest(e.target.value)}
                    placeholder="Şarkı adı veya YouTube linki"
                    required
                  />
                </Form.Group>
                <Button variant="primary" type="submit" className="w-100">
                  İstek Gönder
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
        
        {/* Orta Panel: Sohbet */}
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Sohbet</Card.Title>
              <div className="bg-light rounded p-3 mb-3" style={{height: "400px", overflowY: "auto"}}>
                {messages.length > 0 ? (
                  messages.map((msg) => (
                    <div key={msg.id} className="mb-2">
                      <p className="fw-bold mb-0">{msg.sender}:</p>
                      <p className="ps-2 mb-1">{msg.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted">Henüz mesaj yok</p>
                )}
                <div ref={messagesEndRef} />
              </div>
              <Form onSubmit={handleSendMessage}>
                <div className="d-flex">
                  <Form.Control
                    type="text"
                    className="me-2"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Mesajınızı yazın"
                  />
                  <Button variant="primary" type="submit">
                    Gönder
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
        
        {/* Sağ Panel: Aktif kullanıcılar */}
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Aktif Kullanıcılar ({activeUsers.length})</Card.Title>
              <div className="bg-light rounded p-3" style={{height: "400px", overflowY: "auto"}}>
                {activeUsers.length > 0 ? (
                  activeUsers.map((user) => (
                    <div key={user.id} className="mb-2 p-2 bg-white rounded">
                      <p className="mb-0">{user.username}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted">Aktif kullanıcı yok</p>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default UserPanel;