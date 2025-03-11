// frontend/src/components/AdminPanel.js
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Button, Form, Container, Row, Col, Card, Modal, Table, Tabs, Tab, Alert } from 'react-bootstrap';
import Header from './Header';
import EmojiPicker from 'emoji-picker-react';
import YouTube from 'react-youtube';
import PlayerService from '../services/PlayerService';

const ENDPOINT = 'http://localhost:5000';
let socket;

// YouTube Oynatıcı seçenekleri
const youtubeOpts = {
  height: '180',
  width: '100%',
  playerVars: {
    autoplay: 1,
    controls: 1,
  },
};

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

// YouTube URL'sinden Playlist ID çıkarma işlevi
const getYoutubePlaylistId = (url) => {
  if (!url) return null;
  
  // URL'den playlist ID'sini çıkar
  // Desteklenen formatlar:
  // - https://www.youtube.com/playlist?list=PLAYLIST_ID
  // - https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID
  const regExp = /[&?]list=([a-zA-Z0-9_-]+)/;
  const match = url.match(regExp);
  
  return match ? match[1] : null;
};

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
  const [youtubePlayer, setYoutubePlayer] = useState(null);
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeySaveStatus, setApiKeySaveStatus] = useState('');
  const [autoPlaylistUrl, setAutoPlaylistUrl] = useState('');
  const [autoPlaylistSongs, setAutoPlaylistSongs] = useState(() => {
    // LocalStorage'dan otomatik çalma listesini al
    const savedList = localStorage.getItem('autoPlaylistSongs');
    return savedList ? JSON.parse(savedList) : [];
  });
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  
  // Yedekleme ve yeniden başlatma için durum değişkenleri
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupPath, setBackupPath] = useState('C:\\Users\\MONSTER\\tm\\backups');
  const [backupStatus, setBackupStatus] = useState('');
  const [lastBackupInfo, setLastBackupInfo] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  
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
      console.log("Yeni mesaj alındı:", message); // Debug için
      
      // Kontrol edelim, bazen duplike mesajlar gelebiliyor
      setMessages((prevMessages) => {
        // Aynı ID'ye sahip mesaj varsa ekleme
        if (prevMessages.some(m => m.id === message.id)) {
          return prevMessages;
        }
        return [...prevMessages, message];
      });
      
      // Sohbet geçmişine de ekle
      setChatHistory(prev => {
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        return [message, ...prev].slice(0, 1000);
      });
    });

    // Çalan şarkı güncellendiğinde
    socket.on('updateCurrentSong', (song) => {
      setCurrentSong(song);
      if (song) {
        setYoutubeUrl(song.song);
        
        // Şarkı geçmişine ekle
        setSongHistory(prev => {
          if (prev.some(s => s.id === song.id)) {
            return prev;
          }
          return [song, ...prev].slice(0, 50);
        });
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
    
    // Socket'ten ayar güncellemelerini dinle
    socket.on('updateSettings', (settings) => {
      if (settings.youtubeApiKey) {
        setYoutubeApiKey(settings.youtubeApiKey);
        PlayerService.setApiKey(settings.youtubeApiKey);
      }
    });

    // Yedekleme durum bildirimleri
    socket.on('backupPathUpdated', (data) => {
      if (data.success) {
        setBackupPath(data.path);
        setBackupStatus(`Yedekleme dizini güncellendi: ${data.path}`);
      }
    });

    socket.on('backupCompleted', (data) => {
      setIsBackingUp(false);
      if (data.success) {
        setBackupStatus(`Yedekleme başarılı! Veri ve tam kod yedeği oluşturuldu.`);
        setLastBackupInfo({
          date: new Date(data.date),
          dataPath: data.dataPath,
          codePath: data.codePath
        });
      } else {
        setBackupStatus(`Yedekleme hatası: ${data.message}`);
      }
    });

    socket.on('restoreCompleted', (data) => {
      setIsRestoring(false);
      if (data.success) {
        setBackupStatus(`Geri yükleme başarılı!`);
        // Gerekli verileri güncelle
        if (data.systemState) {
          if (data.systemState.songQueue) setSongQueue(data.systemState.songQueue);
          if (data.systemState.songHistory) setSongHistory(data.systemState.songHistory);
          if (data.systemState.chatHistory) setChatHistory(data.systemState.chatHistory);
          if (data.systemState.headerColor) setHeaderColor(data.systemState.headerColor);
        }
      } else {
        setBackupStatus(`Geri yükleme hatası: ${data.message}`);
      }
    });

    socket.on('restartInitiated', (data) => {
      setIsRestarting(false);
      if (data.success) {
        setBackupStatus(data.message);
        // 5 saniye sonra sayfayı yenile
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      } else {
        setBackupStatus(`Yeniden başlatma hatası: ${data.message}`);
      }
    });

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

    // Yedekleme dizini bilgisini al
    axios.get('http://localhost:5000/api/settings/backup-path')
      .then(response => {
        if (response.data.backupPath) {
          setBackupPath(response.data.backupPath);
        }
      })
      .catch(error => {
        console.error('Yedekleme dizini alınırken hata:', error);
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

  // Otomatik oynatma listesi değiştiğinde localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem('autoPlaylistSongs', JSON.stringify(autoPlaylistSongs));
  }, [autoPlaylistSongs]);

  // Şarkı kuyruğu veya çalan şarkı değiştiğinde otomatik çalmayı kontrol et
  useEffect(() => {
    // Eğer şarkı kuyruğu güncellenirse ve aktif bir şarkı yoksa
    if (!currentSong) {
      // Önce normal kuyruktaki şarkılara bak
      if (songQueue.length > 0) {
        console.log("Sıradaki şarkı otomatik başlatılıyor:", songQueue[0]);
        handlePlaySong(songQueue[0].id);
      } 
      // Kuyrukta şarkı yoksa otomatik listedeki bir şarkıyı çal
      else if (autoPlaylistSongs.length > 0) {
        console.log("Otomatik listeden şarkı başlatılıyor");
        const randomIndex = Math.floor(Math.random() * autoPlaylistSongs.length);
        const autoSong = autoPlaylistSongs[randomIndex];
        playAutoSong(autoSong);
      }
    }
  }, [songQueue, currentSong, autoPlaylistSongs]);

  // YouTube API Key'i değiştiğinde PlayerService'e ayarla
  useEffect(() => {
    if (youtubeApiKey) {
      PlayerService.setApiKey(youtubeApiKey);
    }
  }, [youtubeApiKey]);

  // YouTube Playlist'i yükleme fonksiyonu
  const handleLoadPlaylist = async () => {
    if (!autoPlaylistUrl.trim()) return;
    
    // URL'den playlist ID'sini çıkar
    const playlistId = getYoutubePlaylistId(autoPlaylistUrl);
    
    if (!playlistId) {
      alert('Geçerli bir YouTube playlist URL\'si girin. Örnek: https://www.youtube.com/playlist?list=PLAYLIST_ID');
      return;
    }
    
    setIsLoadingPlaylist(true);
    
    try {
      const response = await axios.get(`http://localhost:5000/api/youtube/playlist/${playlistId}`);
      
      if (response.data.success && response.data.videos && response.data.videos.length > 0) {
        // Her videoyu otomatik listeye ekle
        const newSongs = response.data.videos.map(video => ({
          id: video.id,
          url: video.url,
          title: video.title,
          duration: video.duration,
          addedAt: new Date()
        }));
        
        setAutoPlaylistSongs(prev => [...prev, ...newSongs]);
        
        // Playlist başarıyla yüklendi mesajını göster
        const count = response.data.count || newSongs.length;
        const message = response.data.message || `${count} video otomatik listeye eklendi!`;
        alert(message);
        setAutoPlaylistUrl('');
      } else {
        alert('Çalma listesi bulunamadı veya boş.');
      }
    } catch (error) {
      console.error('Çalma listesi yüklenirken hata:', error);
      alert('Çalma listesi yüklenirken bir hata oluştu: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsLoadingPlaylist(false);
    }
  };

  // Yedekleme dizinini güncelle
  const handleUpdateBackupPath = () => {
    if (backupPath.trim()) {
      socket.emit('updateBackupPath', backupPath);
    }
  };

  // Sistemi yedekle
  const handleBackupSystem = () => {
    setIsBackingUp(true);
    setBackupStatus('Yedekleme işlemi başlatıldı...');
    socket.emit('backupSystem');
  };

  // Yedekten geri yükle
  const handleRestoreSystem = () => {
    if (window.confirm('Sistemi yedekten geri yüklemek istediğinize emin misiniz? Mevcut veriler kaybolacaktır.')) {
      setIsRestoring(true);
      setBackupStatus('Geri yükleme işlemi başlatıldı...');
      socket.emit('restoreSystem');
    }
  };

  // Sistemi yeniden başlat
  const handleRestartSystem = () => {
    if (window.confirm('Sistemi yeniden başlatmak istediğinize emin misiniz? Bağlantılar kesilecektir.')) {
      setIsRestarting(true);
      setBackupStatus('Yeniden başlatma işlemi başlatıldı...');
      socket.emit('restartSystem');
    }
  };

  // Otomatik listeden şarkı çalma
  const playAutoSong = async (song) => {
    // Önce URL'den YouTube ID çıkarmayı dene
    let videoId = getYoutubeId(song.url);
    let songTitle = song.title || song.url;
    let songDuration = song.duration || "Bilinmiyor";
    
    // YouTube ID bulunamadıysa ve API Key varsa, arama yap
    if (!videoId && youtubeApiKey) {
      try {
        videoId = await PlayerService.searchYouTube(song.title || song.url);
      } catch (error) {
        console.error('Şarkı arama hatası:', error);
      }
    }
    
    // Final URL'yi oluştur
    let finalUrl = song.url;
    if (videoId) {
      finalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }
    
    const songObject = {
      id: Date.now().toString(),
      song: finalUrl,
      songTitle: songTitle,
      songDuration: songDuration,
      requestedBy: 'Otomatik Liste',
      requestedAt: new Date()
    };
    
    setCurrentSong(songObject);
    socket.emit('updateCurrentSong', songObject);
  };

  // API Key kaydetme fonksiyonu
  const handleSaveApiKey = async () => {
    setApiKeySaveStatus('Kaydediliyor...');
    
    try {
      console.log('YouTube API Key kaydetme isteği gönderiliyor...');
      const response = await axios.post('http://localhost:5000/api/settings/youtube-api-key', {
        apiKey: youtubeApiKey
      });
      
      console.log('API Key kaydetme yanıtı:', response.data);
      
      if (response.data.success) {
        // API Key'i PlayerService'e ayarla
        PlayerService.setApiKey(youtubeApiKey);
        
        setApiKeySaveStatus('YouTube API Key başarıyla kaydedildi!');
        setTimeout(() => {
          setApiKeySaveStatus('');
          setShowApiKeyModal(false);
        }, 2000);
        
        // Test amaçlı olarak API'yi kontrol et
        try {
          const testVideoId = 'dQw4w9WgXcQ'; // Test video ID
          const videoInfo = await axios.get(`http://localhost:5000/api/youtube/video-info/${testVideoId}`);
          console.log('API Key test sonucu:', videoInfo.data);
        } catch (testError) {
          console.error('API Key test hatası:', testError);
        }
      } else {
        setApiKeySaveStatus('Hata: ' + (response.data.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('API Key kaydedilirken hata:', error);
      setApiKeySaveStatus('Hata: ' + (error.response?.data?.error || error.message || 'Bilinmeyen hata'));
    }
  };

  // YouTube player hazır olduğunda
  const onYoutubeReady = (event) => {
    setYoutubePlayer(event.target);
  };
  
  // YouTube player durduğunda
  const onYoutubeStateChange = (event) => {
    // Video bittiğinde (state = 0)
    if (event.data === 0) {
      // Sunucuya şarkının bittiğini bildir
      socket.emit('autoPlayNext');
    }
  };

  // Admin girişi
  const handleAdminLogin = (e) => {
    e.preventDefault();
    // Bu kısımda kullanıcı adı kontrolünü kaldırıp, şifre kontrolü yapıyoruz
    if (username === 'Tm2025!MusicApp#Admin') { // Güçlü şifre
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
      console.log("Mesaj gönderiliyor:", chatMessage); // Debug için
      
      // Mesajı server'a gönder
      socket.emit('chatMessage', chatMessage);
      
      // Mesajı yerel olarak da ekleyelim (hemen görünmesi için)
      const newMessage = {
        id: Date.now().toString(),
        sender: 'Admin (Admin)',
        text: chatMessage,
        timestamp: new Date()
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      
      // Formu temizle
      setChatMessage('');
      setShowEmojiPicker(false);
    }
  };

  // YouTube URL'sini ayarla ve çal
  const handleManualPlay = async (e) => {
    e.preventDefault();
    if (youtubeUrl.trim()) {
      // Önce URL'den YouTube ID çıkarmayı dene
      let videoId = getYoutubeId(youtubeUrl);
      let songTitle = youtubeUrl;
      let songDuration = "Bilinmiyor";
      
      // YouTube ID bulunamadıysa ve API Key varsa, arama yap
      if (!videoId && youtubeApiKey) {
        videoId = await PlayerService.searchYouTube(youtubeUrl);
      }
      
      // Video bilgilerini al
      if (videoId && youtubeApiKey) {
        try {
          const videoDetails = await axios.get(`http://localhost:5000/api/youtube/video-info/${videoId}`);
          if (videoDetails.data) {
            songTitle = videoDetails.data.title;
            songDuration = videoDetails.data.duration;
          }
        } catch (error) {
          console.error('Video detayları alınamadı:', error);
        }
      }
      
      // Final URL'yi oluştur
      let finalUrl = youtubeUrl;
      if (videoId) {
        finalUrl = `https://www.youtube.com/watch?v=${videoId}`;
      }
      
      const songObject = {
        id: Date.now().toString(),
        song: finalUrl,
        songTitle: songTitle,
        songDuration: songDuration,
        requestedBy: 'Admin (Admin)',
        requestedAt: new Date()
      };
      
      setCurrentSong(songObject);
      socket.emit('updateCurrentSong', songObject);
    }
  };

  // Otomatik listeye şarkı ekle
  const handleAddToAutoPlaylist = async (e) => {
    e.preventDefault();
    if (!autoPlaylistUrl.trim()) return;
    
    // Playlist ID var mı kontrol et
    const playlistId = getYoutubePlaylistId(autoPlaylistUrl);
    
    if (playlistId) {
      // Bu bir playlist URL'si, playlist işleme fonksiyonunu çağır
      handleLoadPlaylist();
      return;
    }
    
    // Normal tekil video işlemi
    // Önce URL'den YouTube ID çıkarmayı dene
    let videoId = getYoutubeId(autoPlaylistUrl);
    let songTitle = autoPlaylistUrl;
    let songDuration = "Bilinmiyor";
    
    // YouTube ID bulunamadıysa ve API Key varsa, arama yap
    if (!videoId && youtubeApiKey) {
      try {
        videoId = await PlayerService.searchYouTube(autoPlaylistUrl);
      } catch (error) {
        console.error('Şarkı arama hatası:', error);
      }
    }
    
    // Video bilgilerini al
    if (videoId && youtubeApiKey) {
      try {
        const videoDetails = await axios.get(`http://localhost:5000/api/youtube/video-info/${videoId}`);
        if (videoDetails.data) {
          songTitle = videoDetails.data.title;
          songDuration = videoDetails.data.duration;
        }
      } catch (error) {
        console.error('Video detayları alınamadı:', error);
      }
    }
    
    // Final URL'yi oluştur
    let finalUrl = autoPlaylistUrl;
    if (videoId) {
      finalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }
    
    // Şarkıyı otomatik listeye ekle
    const newSong = {
      id: Date.now().toString(),
      url: finalUrl,
      title: songTitle,
      duration: songDuration,
      addedAt: new Date()
    };
    
    setAutoPlaylistSongs(prev => [...prev, newSong]);
    setAutoPlaylistUrl('');
    
    alert(`"${songTitle}" otomatik listeye eklendi!`);
  };

  // Otomatik listeden şarkı kaldır
  const handleRemoveFromAutoPlaylist = (songId) => {
    setAutoPlaylistSongs(prev => prev.filter(song => song.id !== songId));
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
          localStorage.removeItem('isAdmin');
          localStorage.removeItem('username');
          // Anasayfaya yönlendir
          window.location.href = '/';
        }}
      />
      
      {/* Üst Şarkı İstek Çubuğu */}
      <div className="py-2 bg-light border-bottom">
        <Container>
          <Form onSubmit={handleManualPlay} className="d-flex align-items-center">
            <Form.Control
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="Şarkıcı ve şarkı ismini yaz veya Link'ini yapıştır"
              className="me-2"
            />
            <Button variant="primary" type="submit" className="me-2">
              <i className="bi bi-music-note-beamed"></i>
            </Button>
            <Button variant="danger" onClick={handleStopSong}>
              <i className="bi bi-stop-fill"></i>
            </Button>
          </Form>
        </Container>
      </div>
      
      <Container className="py-4">
        <Row className="g-4">
          {/* Sol Panel: Şarkı Kontrolleri ve Çalma Listesi */}
          <Col xs={12} md={4}>
            <Card className="mb-4">
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
                
                {/* Çalan şarkı bilgisi */}
                <div className="mb-3">
                  <h6>Şu Anda Çalıyor:</h6>
                  {currentSong ? (
                    <div className="p-3 bg-light rounded">
                      <div className="d-flex">
                        <img 
                          src={getAvatarUrl(currentSong.requestedBy)} 
                          alt={currentSong.requestedBy} 
                          className="rounded-circle me-2" 
                          width="48" 
                          height="48"
                        />
                        <div>
                          <p className="mb-0 fw-medium">
                            <span className="fw-bold">{currentSong.requestedBy}</span> istedi:
                          </p>
                          <p className="mb-0 fw-bold">
                            {currentSong.songTitle || currentSong.song}
                          </p>
                          <p className="text-muted small mb-0">
                            <i className="bi bi-clock me-1"></i> {currentSong.songDuration || "Bilinmiyor"}
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
                  {currentSong ? (
                    getYoutubeId(currentSong.song) ? (
                      // YouTube ID algılandı, videoyu direkt oynat
                      <YouTube
                        videoId={getYoutubeId(currentSong.song)}
                        opts={youtubeOpts}
                        onReady={onYoutubeReady}
                        onStateChange={onYoutubeStateChange}
                      />
                    ) : (
                      // YouTube ID algılanmadı, arama sayfasına yönlendir
                      <div className="ratio ratio-16x9">
                        <iframe 
                          src={`https://www.youtube.com/results?search_query=${encodeURIComponent(currentSong.song)}`}
                          title="YouTube search results" 
                          frameBorder="0"
                          allowFullScreen
                        ></iframe>
                      </div>
                    )
                  ) : (
                    // Çalan bir şarkı yok
                    <div 
                      ref={playerRef}
                      className="w-100 bg-dark text-white d-flex align-items-center justify-content-center"
                      style={{height: "180px"}}
                    >
                      <p className="text-center mb-0">Oynatıcı hazır</p>
                    </div>
                  )}
                </div>
                
                {/* İstek listesi */}
                <h6>İstek Listesi ({songQueue.length})</h6>
                <div className="bg-light rounded p-3" style={{height: "250px", overflowY: "auto"}}>
                  {songQueue.length > 0 ? (
                    songQueue.map((request) => (
                      <div key={request.id} className="mb-2 p-2 bg-white rounded d-flex justify-content-between align-items-center">
                        <div className="d-flex">
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
                            <p className="text-muted small mb-0">
                              <i className="bi bi-clock me-1"></i> {request.songDuration || "Bilinmiyor"}
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
            
            {/* Otomatik Liste */}
            <Card className="mb-4">
              <Card.Body>
                <Card.Title>Otomatik Liste</Card.Title>
                <p className="text-muted small">
                  İstek listesi boş olduğunda otomatik olarak çalacak şarkıları ekleyin.
                </p>
                
                <Form onSubmit={handleAddToAutoPlaylist} className="mb-3">
                  <Form.Group className="mb-2">
                    <Form.Control
                      type="text"
                      value={autoPlaylistUrl}
                      onChange={(e) => setAutoPlaylistUrl(e.target.value)}
                      placeholder="YouTube URL, şarkı adı veya playlist URL'si ekleyin"
                    />
                    <Form.Text className="text-muted">
                      Tekil video veya YouTube çalma listesi URL'si girebilirsiniz.
                    </Form.Text>
                  </Form.Group>
                  <Button 
                    variant="success" 
                    type="submit" 
                    className="w-100"
                    disabled={isLoadingPlaylist}
                  >
                    {isLoadingPlaylist ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Yükleniyor...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-plus-circle me-1"></i> Listeye Ekle
                      </>
                    )}
                  </Button>
                </Form>
                
                <div className="bg-light rounded p-2" style={{maxHeight: "200px", overflowY: "auto"}}>
                  {autoPlaylistSongs.length > 0 ? (
                    autoPlaylistSongs.map((song) => (
                      <div key={song.id} className="mb-2 p-2 bg-white rounded d-flex justify-content-between align-items-center">
                        <div>
                          <p className="mb-0 fw-bold">
                            {song.title || song.url}
                          </p>
                          <p className="text-muted small mb-0">
                            <i className="bi bi-clock me-1"></i> {song.duration || "Bilinmiyor"}
                          </p>
                        </div>
                        <div>
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                            className="me-1"
                            onClick={() => playAutoSong(song)}
                          >
                            <i className="bi bi-play-fill"></i>
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => handleRemoveFromAutoPlaylist(song.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center p-3">Otomatik liste boş</p>
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
                <div className="bg-light rounded p-3" style={{height: "380px", overflowY: "auto"}}>
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
                  <div className="d-grid gap-2">
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      className="mb-2"
                      onClick={() => setShowColorSettingsModal(true)}
                    >
                      <i className="bi bi-palette me-2"></i>
                      Header Renk Ayarları
                    </Button>
                    
                    <Button 
                      variant="outline-info" 
                      size="sm" 
                      className="mb-2"
                      onClick={() => setShowApiKeyModal(true)}
                    >
                      <i className="bi bi-key-fill me-2"></i>
                      YouTube API Ayarları
                    </Button>

                    <Button 
                      variant="outline-success" 
                      size="sm" 
                      className="mb-2"
                      onClick={() => setShowBackupModal(true)}
                    >
                      <i className="bi bi-cloud-upload me-2"></i>
                      Yedekleme ve Sistem Yönetimi
                    </Button>
                  </div>
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
          <div style={{maxHeight: "70vh", overflowY: "auto"}}>
            {songHistory.length > 0 ? (
              <div className="list-group">
                {songHistory.map((song, index) => (
                  <div key={song.id} className="list-group-item py-3">
                    <div className="d-flex">
                      <div className="me-3 text-muted fs-5 mt-2">{index + 1}</div>
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
              <p className="text-center">Şarkı geçmişi bulunamadı</p>
            )}
          </div>
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

      {/* YouTube API Key Modal */}
      <Modal show={showApiKeyModal} onHide={() => {
        setShowApiKeyModal(false);
        setApiKeySaveStatus('');
      }}>
        <Modal.Header closeButton>
          <Modal.Title>YouTube API Ayarları</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            YouTube API Key'inizi buraya girebilirsiniz. Bu key, şarkı arama ve oynatma işlevlerini iyileştirecektir.
          </p>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>YouTube API Key</Form.Label>
              <Form.Control
                type="text"
                value={youtubeApiKey}
                onChange={(e) => setYoutubeApiKey(e.target.value)}
                placeholder="YouTube API Key'inizi girin"
              />
              <Form.Text className="text-muted">
                API Key almak için <a href="https://console.developers.google.com/" target="_blank" rel="noopener noreferrer">Google Developers Console</a> adresini ziyaret edin.
              </Form.Text>
            </Form.Group>
            
            {apiKeySaveStatus && (
              <div className={`alert ${apiKeySaveStatus.includes('başarıyla') ? 'alert-success' : 'alert-danger'}`}>
                {apiKeySaveStatus}
              </div>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowApiKeyModal(false);
            setApiKeySaveStatus('');
          }}>
            İptal
          </Button>
          <Button variant="primary" onClick={handleSaveApiKey}>
            Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Yedekleme ve Sistem Yönetimi Modalı */}
      <Modal show={showBackupModal} onHide={() => setShowBackupModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Yedekleme ve Sistem Yönetimi</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {backupStatus && (
            <Alert variant={backupStatus.includes('hatası') || backupStatus.includes('Hata') ? 'danger' : 'info'}>
              {backupStatus}
            </Alert>
          )}
          
          <Card className="mb-4">
            <Card.Header>Yedekleme Ayarları</Card.Header>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Yedekleme Dizini</Form.Label>
                  <div className="d-flex">
                    <Form.Control
                      type="text"
                      value={backupPath}
                      onChange={(e) => setBackupPath(e.target.value)}
                      placeholder="Örn: C:\Users\MONSTER\tm\backups"
                      className="me-2"
                    />
                    <Button onClick={handleUpdateBackupPath}>Kaydet</Button>
                  </div>
                  <Form.Text className="text-muted">
                    Yedekleme dosyasının nereye kaydedileceğini belirtin. Varsayılan: C:\Users\MONSTER\tm\backups
                  </Form.Text>
                </Form.Group>
              </Form>
              
              <div className="d-grid gap-2 mt-3">
                <Button 
                  variant="success" 
                  onClick={handleBackupSystem}
                  disabled={isBackingUp}
                >
                  {isBackingUp ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Yedekleniyor...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-cloud-upload me-2"></i>
                      Sistem Verilerini ve Kodu Yedekle
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="warning" 
                  onClick={handleRestoreSystem}
                  disabled={isRestoring}
                >
                  {isRestoring ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Geri Yükleniyor...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-cloud-download me-2"></i>
                      Yedekten Geri Yükle
                    </>
                  )}
                </Button>
              </div>
              
              {lastBackupInfo && (
                <div className="mt-3">
                  <p className="mb-0">
                    <strong>Son Yedekleme:</strong> {lastBackupInfo.date.toLocaleString('tr-TR')}
                  </p>
                  <p className="mb-0 text-muted small">
                    <strong>Veri Yedeği:</strong> {lastBackupInfo.dataPath}
                  </p>
                  <p className="mb-0 text-muted small">
                    <strong>Tam Kod Yedeği:</strong> {lastBackupInfo.codePath}
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
          
          <Card>
            <Card.Header>Sistem Yönetimi</Card.Header>
            <Card.Body>
              <div className="mb-3">
                <p>Sistemi yeniden başlatmak, tüm bağlantıları kesip yeniden oluşturacak ve yazılımı sıfırlayacaktır. Bu işlem yaklaşık 5-10 saniye sürer.</p>
                <p>Her yedekleme işlemi, önceki yedeklemeyi siler ve yeni bir yedek oluşturur. Böylece sadece tek bir yedek dosyası tutulur.</p>
              </div>
                
              <Button 
                variant="danger" 
                onClick={handleRestartSystem}
                disabled={isRestarting}
                className="w-100"
              >
                {isRestarting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Yeniden Başlatılıyor...
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-clockwise me-2"></i>
                    Sistemi Yeniden Başlat
                  </>
                )}
              </Button>
            </Card.Body>
          </Card>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBackupModal(false)}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default AdminPanel;