// frontend/src/components/UserPanel.js
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Container, Row, Col, Card, Form, Button, ListGroup, Badge, Tabs, Tab } from 'react-bootstrap';
import Header from './Header';
import EmojiPicker from 'emoji-picker-react';
import PlayerService from '../services/PlayerService';

const ENDPOINT = 'http://localhost:5000';
let socket;

// YouTube URL'sinden ID çıkarma işlevi
const getYoutubeId = (url) => {
  if (!url) return null;
  
  // Direkt olarak ID gönderilmişse (11 karakterlik alfanumerik değer)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }
  
  // YouTube URL kontrolü
  // Desteklenen formatlar:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&].*)?$/;
  const match = url.match(regExp);
  
  return match ? match[1] : null;
};

const UserPanel = () => {
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [currentSong, setCurrentSong] = useState(null);
  const [songQueue, setSongQueue] = useState([]);
  const [songHistory, setSongHistory] = useState([]);
  const [songRequest, setSongRequest] = useState('');
  const [requestStatus, setRequestStatus] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [headerColor, setHeaderColor] = useState('#212529');
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  
  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Sayfa yüklendiğinde kullanıcı adı giriş ekranını göster
  useEffect(() => {
    // Local storage'dan kullanıcı kontrolü
    const storedUsername = localStorage.getItem('username');
    if (storedUsername && storedUsername !== 'Admin') {
      setUsername(storedUsername);
      setIsLoggedIn(true);
      
      // Socket.io bağlantısını başlat
      initializeSocket(storedUsername);
    }

    // YouTube API Key'i al
    axios.get('http://localhost:5000/api/settings/youtube-api-key')
      .then(response => {
        if (response.data.youtubeApiKey) {
          setYoutubeApiKey(response.data.youtubeApiKey);
          PlayerService.setApiKey(response.data.youtubeApiKey);
        }
      })
      .catch(error => {
        console.error('YouTube API Key alınırken hata:', error);
      });
  }, []);
  
  // Socket.io bağlantısını başlat
  const initializeSocket = (user) => {
    socket = io(ENDPOINT);
    
    socket.on('connect', () => {
      console.log('Socket.io bağlantısı kuruldu!');
      socket.emit('setUsername', user);
    });
    
    // Başlangıç durumunu al
    socket.on('initialState', ({ songQueue, currentSong, activeUsers, songHistory, headerColor }) => {
      setSongQueue(songQueue || []);
      if (currentSong) setCurrentSong(currentSong);
      setActiveUsers(activeUsers || []);
      if (songHistory) setSongHistory(songHistory);
      if (headerColor) setHeaderColor(headerColor);
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
    
    // Şarkı sırası güncellendiğinde
    socket.on('updateSongQueue', (queue) => {
      setSongQueue(queue);
    });
    
    // Şarkı geçmişi güncellendiğinde
    socket.on('updateSongHistory', (history) => {
      setSongHistory(history);
    });
    
    // Header rengi güncellendiğinde
    socket.on('updateHeaderColor', (color) => {
      setHeaderColor(color);
    });
    
    // Socket'ten ayar güncellemelerini dinle
    socket.on('updateSettings', (settings) => {
      if (settings.youtubeApiKey) {
        setYoutubeApiKey(settings.youtubeApiKey);
        PlayerService.setApiKey(settings.youtubeApiKey);
      }
    });
    
    // Bağlantı hatası olduğunda
    socket.on('connect_error', (error) => {
      console.error('Bağlantı hatası:', error);
    });
    
    // Bağlantı kapandığında
    return () => {
      socket.disconnect();
    };
  };
  
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

  // YouTube API Key'i değiştiğinde PlayerService'e ayarla
  useEffect(() => {
    if (youtubeApiKey) {
      PlayerService.setApiKey(youtubeApiKey);
    }
  }, [youtubeApiKey]);

  // Kullanıcı girişi
  const handleUserLogin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setIsLoggedIn(true);
      localStorage.setItem('username', username);
      
      // Socket.io bağlantısını başlat
      initializeSocket(username);
    }
  };
  
  // Profil resmi oluştur (Pravatar API)
  const getAvatarUrl = (username) => {
    // Kullanıcı adından basit bir hash değeri üret
    const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `https://i.pravatar.cc/40?img=${hash % 70}`; // 70 farklı avatar var
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
  
  // Emoji ekle
  const onEmojiClick = (emojiObject) => {
    setChatMessage(prev => prev + emojiObject.emoji);
  };
  
  // Emoji picker'ı göster/gizle
  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };
  
  // Çıkış yap
  const handleLogout = () => {
    if (window.confirm('Çıkış yapmak istediğinize emin misiniz?')) {
      localStorage.removeItem('username');
      setIsLoggedIn(false);
      setUsername('');
      socket.disconnect();
      window.location.href = '/';
    }
  };

  // Youtube video sona erdiğinde bildirme
  const handleVideoEnded = () => {
    console.log("Video sona erdi, sunucuya bildiriliyor");
    socket.emit('autoPlayNext');
  };

  // Kullanıcı henüz giriş yapmadıysa login ekranını göster
  if (!isLoggedIn) {
    return (
      <>
        <Header isAdmin={false} activeUsers={[]} headerColor={headerColor} />
        <Container className="d-flex align-items-center justify-content-center" style={{minHeight: "calc(100vh - 76px)"}}>
          <Card className="shadow-sm" style={{maxWidth: "400px", width: "100%"}}>
            <Card.Body className="p-4">
              <h2 className="text-center mb-4">Misafir Girişi</h2>
              <Form onSubmit={handleUserLogin}>
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
                <Button variant="primary" type="submit" className="w-100">
                  Giriş Yap
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
        isAdmin={false} 
        activeUsers={activeUsers} 
        headerColor={headerColor}
        isLoggedIn={isLoggedIn}
        username={username}
        onLogout={handleLogout}
      />
      
      {/* Üst Şarkı İstek Çubuğu */}
      <div className="py-2 bg-light border-bottom">
        <Container>
          <Form onSubmit={async (e) => {
            e.preventDefault();
            if (songRequest.trim()) {
              // Önce URL'den YouTube ID çıkarmayı dene
              let videoId = getYoutubeId(songRequest);
              
              // YouTube ID bulunamadıysa ve API Key varsa, arama yap
              if (!videoId && youtubeApiKey) {
                try {
                  videoId = await PlayerService.searchYouTube(songRequest);
                } catch (error) {
                  console.error('Şarkı arama hatası:', error);
                }
              }
              
              // Final URL'yi oluştur
              let finalRequest = songRequest;
              if (videoId) {
                finalRequest = `https://www.youtube.com/watch?v=${videoId}`;
              }
              
              // Şarkı isteği gönder
              socket.emit('requestSong', { song: finalRequest });
              setSongRequest('');
              
              // Başarı mesajı göster
              setRequestStatus('Şarkı isteğiniz alındı! 🎵');
              setTimeout(() => setRequestStatus(''), 3000);
            }
          }}>
            <div className="d-flex align-items-center">
              <Form.Control 
                type="text" 
                placeholder="Şarkıcı ve şarkı ismini yaz veya Link'ini yapıştır"
                value={songRequest}
                onChange={(e) => setSongRequest(e.target.value)}
                className="me-2"
              />
              <Button variant="primary" type="submit">
                <i className="bi bi-music-note-beamed"></i>
              </Button>
            </div>
            
            {requestStatus && (
              <div className="alert alert-success mt-1 py-1 px-2 small">
                {requestStatus}
              </div>
            )}
          </Form>
        </Container>
      </div>
      
      <Container className="py-4">
        <Row className="g-4">
          {/* Sol Panel: Şarkı İstekleri ve Bilgiler */}
          <Col xs={12} md={6}>
            {/* Çalan Şarkı ve İstek Listesi */}
            <Card className="mb-4">
              <Card.Body>
                <Tabs defaultActiveKey="nowPlaying" id="music-tabs">
                  <Tab eventKey="nowPlaying" title="Şu Anda Çalıyor">
                    {currentSong ? (
                      <div className="p-3">
                        <div className="d-flex mb-3">
                          <img 
                            src={getAvatarUrl(currentSong.requestedBy)} 
                            alt={currentSong.requestedBy} 
                            className="rounded-circle me-2" 
                            width="48" 
                            height="48"
                          />
                          <div>
                            <h5 className="mb-0">
                              {currentSong.requestedBy} istedi:
                            </h5>
                            <p className="mb-0 fw-bold">
                              {currentSong.songTitle || currentSong.song}
                            </p>
                            <p className="text-muted mb-2">
                              <i className="bi bi-clock me-1"></i> {currentSong.songDuration || "Bilinmiyor"}
                            </p>
                          </div>
                        </div>
                        
                        {/* Mini YouTube Oynatıcı */}
                        <div className="ratio ratio-16x9 mt-2">
                          {getYoutubeId(currentSong.song) ? (
                            <iframe 
                              src={`https://www.youtube.com/embed/${getYoutubeId(currentSong.song)}?autoplay=1&controls=1`}
                              title="YouTube video player" 
                              frameBorder="0" 
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                              allowFullScreen
                            ></iframe>
                          ) : (
                            <div className="bg-dark d-flex align-items-center justify-content-center text-white p-4">
                              <p className="mb-0">
                                Çalıyor: {currentSong.songTitle || currentSong.song}
                                <br />
                                <small>(YouTube oynatıcı bu içeriği bulamadı)</small>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-center p-3">Şu anda çalan şarkı yok</p>
                    )}
                  </Tab>
                  
                  <Tab eventKey="queue" title={`İstek Listesi (${songQueue.length})`}>
                    <div style={{maxHeight: "350px", overflowY: "auto"}}>
                      {songQueue.length > 0 ? (
                        <div className="list-group list-group-flush">
                          {songQueue.map((request, index) => (
                            <div key={request.id} className="list-group-item py-3">
                              <div className="d-flex">
                                <div className="me-3 text-muted fs-5 mt-2">{index + 1}</div>
                                <img 
                                  src={getAvatarUrl(request.requestedBy)} 
                                  alt={request.requestedBy} 
                                  className="rounded-circle me-2" 
                                  width="40" 
                                  height="40"
                                />
                                <div>
                                  <p className="mb-0 fw-medium">
                                    <span className="fw-bold">{request.requestedBy}</span> istedi:
                                  </p>
                                  <p className="mb-0 fw-bold">
                                    {request.songTitle || request.song}
                                  </p>
                                  <small className="text-muted">
                                    <i className="bi bi-clock me-1"></i> {request.songDuration || "Bilinmiyor"}
                                  </small>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center p-3">İstek listesi boş</p>
                      )}
                    </div>
                  </Tab>
                  
                  <Tab eventKey="history" title="Geçmiş">
                    <div style={{maxHeight: "350px", overflowY: "auto"}}>
                      {songHistory.length > 0 ? (
                        <div className="list-group list-group-flush">
                          {songHistory.map((song) => (
                            <div key={song.id} className="list-group-item py-3">
                              <div className="d-flex">
                                <img 
                                  src={getAvatarUrl(song.requestedBy)} 
                                  alt={song.requestedBy} 
                                  className="rounded-circle me-2" 
                                  width="40" 
                                  height="40"
                                />
                                <div>
                                  <p className="mb-0 fw-medium">
                                    <span className="fw-bold">{song.requestedBy}</span> istedi:
                                  </p>
                                  <p className="mb-0 fw-bold">
                                    {song.songTitle || song.song}
                                  </p>
                                  <small className="text-muted">
                                    <i className="bi bi-clock me-1"></i> {song.songDuration || "Bilinmiyor"} • 
                                    <i className="bi bi-calendar-event ms-2 me-1"></i> {new Date(song.requestedAt).toLocaleString('tr-TR')}
                                  </small>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center p-3">Şarkı geçmişi boş</p>
                      )}
                    </div>
                  </Tab>
                </Tabs>
              </Card.Body>
            </Card>
          </Col>
          
          {/* Sağ Panel: Sohbet ve Aktif Kullanıcılar */}
          <Col xs={12} md={6}>
            <Card className="mb-4 h-100">
              <Card.Body>
                <Card.Title>Sohbet</Card.Title>
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
        </Row>
      </Container>
    </>
  );
};

export default UserPanel;