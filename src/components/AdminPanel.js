// frontend/src/components/AdminPanel.js
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Button, Form, Container, Row, Col, Card, Modal, Table, Tabs, Tab } from 'react-bootstrap';
import Header from './Header';
import EmojiPicker from 'emoji-picker-react';

const ENDPOINT = 'http://localhost:5000';
let socket;

const AdminPanel = () => {
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [songQueue, setSongQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [songHistory, setSongHistory] = useState([]);
  const [showSongHistory, setShowSongHistory] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [headerColor, setHeaderColor] = useState('#212529');
  const [showColorSettingsModal, setShowColorSettingsModal] = useState(false);
  
  const messagesEndRef = useRef(null);
  const playerRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Socket.io bağlantısını kur
  useEffect(() => {
    socket = io(ENDPOINT);
    
    // Bağlantı başarılı olduğunda
    socket.on('connect', () => {
      console.log('Socket.io bağlantısı kuruldu!');
    });

    // Başlangıç durumunu al
    socket.on('initialState', ({ songQueue, currentSong, activeUsers, songHistory, chatHistory, headerColor }) => {
      setSongQueue(songQueue || []);
      if (currentSong) setCurrentSong(currentSong);
      setActiveUsers(activeUsers || []);
      if (songHistory) setSongHistory(songHistory);
      if (chatHistory) setChatHistory(chatHistory);
      if (headerColor) setHeaderColor(headerColor);
    });

    // Şarkı sırası güncellendiğinde
    socket.on('updateSongQueue', (queue) => {
      setSongQueue(queue);
    });

    // Aktif kullanıcılar güncellendiğinde
    socket.on('updateActiveUsers', (users) => {
      setActiveUsers(users);
    });

    // Yeni sohbet mesajı geldiğinde
    socket.on('newChatMessage', (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
      
      // Sohbet geçmişine de ekle
      setChatHistory(prev => [message, ...prev].slice(0, 1000));
    });

    // Çalan şarkı güncellendiğinde
    socket.on('updateCurrentSong', (song) => {
      setCurrentSong(song);
      if (song) {
        setYoutubeUrl(song.song);
        
        // Şarkı geçmişine ekle
        setSongHistory(prev => [song, ...prev].slice(0, 50));
      }
    });
    
    // Şarkı geçmişi güncellendiğinde
    socket.on('updateSongHistory', (history) => {
      setSongHistory(history);
    });
    
    // Sohbet geçmişi güncellendiğinde
    socket.on('updateChatHistory', (history) => {
      setChatHistory(history);
    });
    
    // Header rengi güncellendiğinde
    socket.on('updateHeaderColor', (color) => {
      setHeaderColor(color);
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
  
  // Emoji picker dışında bir yere tıklandığında kapanması için
  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [emojiPickerRef]);

  // Admin girişi
  const handleAdminLogin = (e) => {
    e.preventDefault();
    // Bu kısımda kullanıcı adı kontrolünü kaldırıp, şifre kontrolü yapıyoruz
    if (username === 'admin123') { // username aslında şifre olarak kullanılıyor
      setUsername('Admin'); // Kullanıcı adını Admin olarak sabitliyoruz
      setIsLoggedIn(true);
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('username', 'Admin');
      
      // Socket bağlantısı
      socket.emit('setUsername', 'Admin (Admin)');
      
      // Geçmiş bilgileri al
      socket.emit('getSongHistory');
      socket.emit('getChatHistory');
    } else {
      // Şifre yanlışsa hata göster
      alert('Geçersiz şifre!');
    }
  };

  // Şarkıyı çal
  const handlePlaySong = (songId) => {
    socket.emit('playSong', songId);
  };

  // Şarkıyı durdur
  const handleStopSong = () => {
    socket.emit('stopSong');
  };

  // Sohbet mesajı gönder
  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (chatMessage.trim()) {
      socket.emit('chatMessage', chatMessage);
      setChatMessage('');
      setShowEmojiPicker(false);
    }
  };

  // YouTube URL'sini ayarla ve çal
  const handleManualPlay = (e) => {
    e.preventDefault();
    if (youtubeUrl.trim()) {
      const songObject = {
        id: Date.now().toString(),
        song: youtubeUrl,
        requestedBy: 'Admin (Admin)',
        requestedAt: new Date()
      };
      setCurrentSong(songObject);
      socket.emit('updateCurrentSong', songObject);
    }
  };
  
  // Şarkı geçmişini göster/gizle
  const toggleSongHistory = () => {
    setShowSongHistory(!showSongHistory);
  };
  
  // Sohbet geçmişini göster/gizle
  const toggleChatHistory = () => {
    setShowChatHistory(!showChatHistory);
  };
  
  // Emoji ekle
  const onEmojiClick = (emojiObject) => {
    setChatMessage(prev => prev + emojiObject.emoji);
  };
  
  // Emoji picker'ı göster/gizle
  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };
  
  // Header rengini değiştir
  const handleColorChange = (newColor) => {
    setHeaderColor(newColor);
    socket.emit('updateHeaderColor', newColor);
  };

  // Profil resmi oluştur (Pravatar API)
  const getAvatarUrl = (username) => {
    // Kullanıcı adından basit bir hash değeri üret
    const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `https://i.pravatar.cc/40?img=${hash % 70}`; // 70 farklı avatar var
  };

  // Admin henüz giriş yapmadıysa login ekranını göster
  if (!isLoggedIn) {
    return (
      <>
        <Header isAdmin={true} activeUsers={[]} headerColor={headerColor} />
        <Container className="d-flex align-items-center justify-content-center" style={{minHeight: "calc(100vh - 76px)"}}>
          <Card className="shadow-sm" style={{maxWidth: "400px", width: "100%"}}>
            <Card.Body className="p-4">
              <h2 className="text-center mb-4">Admin Girişi</h2>
              <Form onSubmit={handleAdminLogin}>
                <Form.Group className="mb-3">
                  <Form.Label>Admin Şifresi</Form.Label>
                  <Form.Control
                    type="password"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Admin şifrenizi girin"
                    required
                  />
                </Form.Group>
                <Button variant="primary" type="submit" className="w-100">
                  Admin Girişi
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Container>
      </>
    );
  }

  return (
    <>
      <Header 
        isAdmin={true} 
        activeUsers={activeUsers} 
        headerColor={headerColor}
        onColorChange={handleColorChange}
        onLogout={() => {
          socket.disconnect();
        }}
      />
      <Container className="py-4">
        <Row className="g-4">
          {/* Sol Panel: Şarkı Kontrolleri ve Çalma Listesi */}
          <Col xs={12} md={4}>
            <Card className="mb-4 h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <Card.Title>Şarkı Kontrolleri</Card.Title>
                  <Button 
                    variant="outline-secondary" 
                    size="sm"
                    onClick={toggleSongHistory}
                  >
                    Şarkı Geçmişi
                  </Button>
                </div>
                
                {/* Manuel YouTube URL girişi */}
                <Form onSubmit={handleManualPlay} className="mb-3">
                  <Form.Group className="mb-2">
                    <Form.Label>YouTube URL veya Şarkı Adı</Form.Label>
                    <Form.Control
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="YouTube URL girin"
                    />
                  </Form.Group>
                  <div className="d-flex gap-2">
                    <Button variant="primary" type="submit" className="flex-grow-1">
                      <i className="bi bi-play-fill me-1"></i> Çal
                    </Button>
                    <Button 
                      variant="danger" 
                      className="flex-grow-1"
                      onClick={handleStopSong}
                    >
                      <i className="bi bi-stop-fill me-1"></i> Durdur
                    </Button>
                  </div>
                </Form>
                
                {/* Çalan şarkı bilgisi */}
                <div className="mb-3">
                  <h6>Şu Anda Çalıyor:</h6>
                  {currentSong ? (
                    <div className="p-3 bg-light rounded">
                      <div className="d-flex align-items-center mb-2">
                        <img 
                          src={getAvatarUrl(currentSong.requestedBy)} 
                          alt={currentSong.requestedBy} 
                          className="rounded-circle me-2" 
                          width="32" 
                          height="32"
                        />
                        <div>
                          <p className="fw-bold mb-0">{currentSong.song}</p>
                          <p className="text-muted small mb-0">
                            İsteyen: {currentSong.requestedBy}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted">Şu anda çalan şarkı yok</p>
                  )}
                </div>
                
                {/* YouTube Oynatıcı Alanı */}
                <div className="mb-3">
                  <div 
                    ref={playerRef}
                    className="w-100 bg-dark text-white d-flex align-items-center justify-content-center"
                    style={{height: "180px"}}
                  >
                    {currentSong ? (
                      <p className="text-center mb-0">Burada YouTube oynatıcı olacak:<br/>{currentSong.song}</p>
                    ) : (
                      <p className="text-center mb-0">Oynatıcı hazır</p>
                    )}
                  </div>
                </div>
                
                {/* İstek listesi */}
                <h6>İstek Listesi ({songQueue.length})</h6>
                <div className="bg-light rounded p-3" style={{height: "250px", overflowY: "auto"}}>
                  {songQueue.length > 0 ? (
                    songQueue.map((request) => (
                      <div key={request.id} className="mb-2 p-2 bg-white rounded d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center">
                          <img 
                            src={getAvatarUrl(request.requestedBy)} 
                            alt={request.requestedBy} 
                            className="rounded-circle me-2" 
                            width="24" 
                            height="24"
                          />
                          <div>
                            <p className="fw-bold mb-0">{request.song}</p>
                            <p className="text-muted small mb-0">
                              İsteyen: {request.requestedBy}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="success" 
                          size="sm"
                          onClick={() => handlePlaySong(request.id)}
                        >
                          <i className="bi bi-play-fill"></i>
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted">İstek listesi boş</p>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
          
          {/* Orta Panel: Sohbet */}
          <Col xs={12} md={4}>
            <Card className="mb-4 h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <Card.Title>Sohbet</Card.Title>
                  <Button 
                    variant="outline-secondary" 
                    size="sm"
                    onClick={toggleChatHistory}
                  >
                    Sohbet Geçmişi
                  </Button>
                </div>
                <div className="bg-light rounded p-3 mb-3" style={{height: "500px", overflowY: "auto"}}>
                  {messages.length > 0 ? (
                    messages.map((msg) => (
                      <div key={msg.id} className="d-flex mb-2 align-items-start">
                        <img 
                          src={getAvatarUrl(msg.sender)} 
                          alt={msg.sender} 
                          className="rounded-circle me-2" 
                          width="32" 
                          height="32"
                        />
                        <div>
                          <span className="fw-bold">{msg.sender}:</span>{' '}
                          <span>{msg.text}</span>
                        </div>
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <div className="d-flex" style={{ position: 'relative' }}>
                      <Button 
                        variant="outline-secondary" 
                        className="me-2"
                        onClick={toggleEmojiPicker}
                      >
                        <i className="bi bi-emoji-smile"></i>
                      </Button>
                      <Button variant="primary" type="submit">
                        <i className="bi bi-send-fill"></i>
                      </Button>
                      
                      {showEmojiPicker && (
                        <div 
                          ref={emojiPickerRef}
                          style={{
                            position: 'absolute', 
                            bottom: '45px', 
                            right: '0', 
                            zIndex: 1000
                          }}
                        >
                          <EmojiPicker onEmojiClick={onEmojiClick} />
                        </div>
                      )}
                    </div>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
          
          {/* Sağ Panel: Aktif kullanıcılar ve moderasyon */}
          <Col xs={12} md={4}>
            <Card className="mb-4 h-100">
              <Card.Body>
                <Card.Title>Aktif Kullanıcılar ({activeUsers.length})</Card.Title>
                <div className="bg-light rounded p-3" style={{height: "500px", overflowY: "auto"}}>
                  {activeUsers.length > 0 ? (
                    activeUsers.map((user) => (
                      <div key={user.id} className="mb-2 p-2 bg-white rounded d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center">
                          <img 
                            src={getAvatarUrl(user.username)} 
                            alt={user.username} 
                            className="rounded-circle me-2" 
                            width="32" 
                            height="32"
                          />
                          <p className="mb-0">{user.username}</p>
                        </div>
                        <Button variant="outline-danger" size="sm">
                          <i className="bi bi-x-circle"></i>
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted">Aktif kullanıcı yok</p>
                  )}
                </div>
                
                <div className="mt-3">
                  <Button 
                    variant="outline-primary" 
                    size="sm" 
                    className="w-100"
                    onClick={() => setShowColorSettingsModal(true)}
                  >
                    <i className="bi bi-palette me-2"></i>
                    Header Renk Ayarları
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
      
      {/* Şarkı Geçmişi Modal */}
      <Modal show={showSongHistory} onHide={toggleSongHistory} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Şarkı Geçmişi</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table striped hover>
            <thead>
              <tr>
                <th>#</th>
                <th>Şarkı</th>
                <th>İsteyen</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {songHistory.length > 0 ? (
                songHistory.map((song, index) => (
                  <tr key={song.id}>
                    <td>{index + 1}</td>
                    <td>{song.song}</td>
                    <td>
                      <div className="d-flex align-items-center">
                        <img 
                          src={getAvatarUrl(song.requestedBy)} 
                          alt={song.requestedBy} 
                          className="rounded-circle me-2" 
                          width="24" 
                          height="24"
                        />
                        {song.requestedBy}
                      </div>
                    </td>
                    <td>{new Date(song.requestedAt).toLocaleString('tr-TR')}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center">Şarkı geçmişi bulunamadı</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Modal.Body>
      </Modal>
      
      {/* Sohbet Geçmişi Modal */}
      <Modal show={showChatHistory} onHide={toggleChatHistory} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Sohbet Geçmişi</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{maxHeight: "70vh", overflowY: "auto"}}>
          {chatHistory.length > 0 ? (
            chatHistory.map((msg) => (
              <div key={msg.id} className="d-flex mb-3 border-bottom pb-2">
                <img 
                  src={getAvatarUrl(msg.sender)} 
                  alt={msg.sender} 
                  className="rounded-circle me-2" 
                  width="32" 
                  height="32"
                />
                <div>
                  <div className="d-flex align-items-center mb-1">
                    <span className="fw-bold me-2">{msg.sender}</span>
                    <small className="text-muted">
                      {new Date(msg.timestamp).toLocaleString('tr-TR')}
                    </small>
                  </div>
                  <p className="mb-0">{msg.text}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted">Sohbet geçmişi bulunamadı</p>
          )}
        </Modal.Body>
      </Modal>
      
      {/* Renk Ayarları Modal */}
      <Modal show={showColorSettingsModal} onHide={() => setShowColorSettingsModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Header Renk Ayarları</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>En Üst Zemin Rengi</Form.Label>
              <Form.Control 
                type="color" 
                value={headerColor}
                onChange={(e) => setHeaderColor(e.target.value)}
                title="Header rengi seçin"
              />
            </Form.Group>
            
            <div className="mb-3">
              <p>Hızlı Renkler:</p>
              <div className="d-flex gap-2">
                {['#212529', '#0d6efd', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#198754', '#20c997', '#0dcaf0'].map((color) => (
                  <div 
                    key={color} 
                    className="color-box border" 
                    style={{
                      backgroundColor: color,
                      width: '30px',
                      height: '30px',
                      cursor: 'pointer',
                      borderRadius: '4px'
                    }}
                    onClick={() => setHeaderColor(color)}
                  />
                ))}
              </div>
            </div>
            
            <div className="p-3 mb-3" style={{backgroundColor: headerColor, color: '#fff'}}>
              <p className="mb-0">Önizleme</p>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowColorSettingsModal(false)}>
            İptal
          </Button>
          <Button variant="primary" onClick={() => {
            handleColorChange(headerColor);
            setShowColorSettingsModal(false);
          }}>
            Uygula
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default AdminPanel;