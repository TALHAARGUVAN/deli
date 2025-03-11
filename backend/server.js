// backend/server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const archiver = require('archiver');

// Express uygulaması oluştur
const app = express();
const server = http.createServer(app);

// CORS yapılandırması
app.use(cors());
app.use(bodyParser.json());

// Socket.io ile WebSocket bağlantısı kur
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Yedekleme için dizin kontrolü
const checkAndCreateDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Dizin oluşturuldu: ${dir}`);
  }
};

// Dizini ZIP olarak sıkıştırma
const zipDirectory = (sourceDir, outPath) => {
  return new Promise((resolve, reject) => {
    // Çıktı dosyası oluştur
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // En yüksek sıkıştırma seviyesi
    });

    // Bağlantı olaylarını işle
    output.on('close', () => {
      console.log('Arşiv başarıyla oluşturuldu. Toplam boyut: ' + archive.pointer() + ' bytes');
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    // Arşivi çıktı stream'ine bağla
    archive.pipe(output);

    // Dizini arşive ekle
    archive.directory(sourceDir, false);

    // Arşivlemeyi sonlandır
    archive.finalize();
  });
};

// In-memory veri depolama
let songQueue = [];
let currentSong = null;
let activeUsers = [];
let songHistory = [];
let chatHistory = [];
let headerColor = '#212529';
let youtubeApiKey = config.youtubeApiKey;
let backupPath = './backups'; // Varsayılan yedekleme dizini

// Socket.io bağlantı işlemleri
io.on('connection', (socket) => {
  console.log('Yeni bir kullanıcı bağlandı');
  
  // Kullanıcı adı ayarla
  socket.on('setUsername', (username) => {
    // Kullanıcı adı boş değilse ekle
    if (username) {
      const userId = socket.id;
      // Kullanıcı zaten aktif mi kontrol et
      const existingUserIndex = activeUsers.findIndex(user => user.username === username);
      
      if (existingUserIndex >= 0) {
        // Kullanıcı zaten var, sadece ID'sini güncelle
        activeUsers[existingUserIndex].id = userId;
      } else {
        // Yeni kullanıcı ekle
        activeUsers.push({ id: userId, username });
      }
      
      // Aktif kullanıcılar listesini güncelle
      io.emit('updateActiveUsers', activeUsers);
      
      // İlk bağlantıda başlangıç durumunu gönder
      socket.emit('initialState', { 
        songQueue, 
        currentSong, 
        activeUsers, 
        songHistory,
        chatHistory: chatHistory.slice(0, 50), // Son 50 mesaj
        headerColor
      });
      
      console.log(`Kullanıcı adı ayarlandı: ${username}`);
    }
  });
  
  // Bağlantı kesildiğinde
  socket.on('disconnect', () => {
    // Aktif kullanıcılar listesinden çıkar
    activeUsers = activeUsers.filter(user => user.id !== socket.id);
    
    // Aktif kullanıcılar listesini güncelle
    io.emit('updateActiveUsers', activeUsers);
    
    console.log('Kullanıcı bağlantısı kesildi');
  });
  
  // Şarkı isteği alındığında
  socket.on('requestSong', async ({ song }) => {
    if (song) {
      try {
        // İsteği yapan kullanıcıyı bul
        const user = activeUsers.find(user => user.id === socket.id);
        if (!user) {
          console.log('Kullanıcı bulunamadı, istek reddedildi');
          return;
        }
        
        const username = user.username;
        
        // YouTube video ID'sini URL'den çıkarmayı dene
        const videoId = getYoutubeId(song);
        let songTitle = song;
        let songDuration = "Bilinmiyor";
        
        // Video bilgilerini al
        if (videoId && youtubeApiKey) {
          try {
            const videoDetails = await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${youtubeApiKey}`);
            
            if (videoDetails.data.items && videoDetails.data.items.length > 0) {
              // Video başlığını al
              songTitle = videoDetails.data.items[0].snippet.title;
              
              // Video süresini al ve biçimlendir
              const duration = videoDetails.data.items[0].contentDetails.duration;
              // ISO 8601 formatındaki süreyi dönüştür (PT1H2M3S -> 1:02:03)
              songDuration = duration.replace(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/, (_, h, m, s) => {
                const hours = h ? h + ':' : '';
                const minutes = m ? (h && m.length === 1 ? '0' + m : m) + ':' : h ? '00:' : '';
                const seconds = s ? (s.length === 1 ? '0' + s : s) : '00';
                return hours + minutes + seconds;
              });
            }
          } catch (error) {
            console.error('Video detayları alınırken hata:', error);
          }
        }
        
        // Şarkı nesnesi oluştur
        const songRequest = {
          id: uuidv4(),
          song: song,
          songTitle: songTitle,
          songDuration: songDuration,
          requestedBy: username,
          requestedAt: new Date()
        };
        
        // Şarkı sırasına ekle
        songQueue.push(songRequest);
        
        // Şarkı sırasını güncelle
        io.emit('updateSongQueue', songQueue);
        
        console.log(`Şarkı isteği alındı: ${song} - İsteyen: ${username}`);
        
        // Eğer şu anda çalan şarkı yoksa, ilk sıradaki şarkıyı çal
        if (!currentSong && songQueue.length === 1) {
          playSong(songQueue[0].id);
        }
      } catch (error) {
        console.error('Şarkı isteği işlenirken hata:', error);
      }
    }
  });
  
  // Sohbet mesajı alındığında
  socket.on('chatMessage', (message) => {
    if (message) {
      // İsteği yapan kullanıcıyı bul
      const user = activeUsers.find(user => user.id === socket.id);
      if (!user) {
        console.log('Kullanıcı bulunamadı, mesaj reddedildi');
        return;
      }
      
      const username = user.username;
      
      // Mesaj nesnesi oluştur
      const chatMessage = {
        id: uuidv4(),
        sender: username,
        text: message,
        timestamp: new Date()
      };
      
      // Mesajı sohbet geçmişine ekle
      chatHistory.unshift(chatMessage);
      
      // Mesajı tüm kullanıcılara gönder
      io.emit('newChatMessage', chatMessage);
      
      console.log(`Sohbet mesajı alındı: ${message} - Gönderen: ${username}`);
    }
  });
  
  // Şarkıyı çalma komutu alındığında
  socket.on('playSong', (songId) => {
    playSong(songId);
  });
  
  // Şarkıyı durdurma komutu alındığında
  socket.on('stopSong', () => {
    // Şu anki şarkıyı sonlandır
    currentSong = null;
    io.emit('updateCurrentSong', null);
    console.log('Şarkı durduruldu');
  });
  
  // Bir sonraki şarkıya geçme komutu alındığında
  socket.on('autoPlayNext', () => {
    playNextSong();
  });
  
  // Admin'den gelen çalan şarkı güncelleme
  socket.on('updateCurrentSong', (song) => {
    currentSong = song;
    io.emit('updateCurrentSong', currentSong);
    
    // Şarkıyı geçmişe ekle
    if (song) {
      songHistory.unshift(song);
      io.emit('updateSongHistory', songHistory);
    }
    
    console.log('Çalan şarkı güncellendi:', song);
  });
  
  // Header rengini güncelleme
  socket.on('updateHeaderColor', (color) => {
    headerColor = color;
    io.emit('updateHeaderColor', headerColor);
    console.log('Header rengi güncellendi:', color);
  });
  
  // Şarkı geçmişini talep etme
  socket.on('getSongHistory', () => {
    socket.emit('updateSongHistory', songHistory);
  });
  
  // Sohbet geçmişini talep etme
  socket.on('getChatHistory', () => {
    socket.emit('updateChatHistory', chatHistory);
  });

  // Yedekleme dizinini güncelleme
  socket.on('updateBackupPath', (path) => {
    if (path) {
      backupPath = path;
      console.log('Yedekleme dizini güncellendi:', backupPath);
      socket.emit('backupPathUpdated', { success: true, path: backupPath });
    }
  });

  // Sistem verilerini yedekleme
  socket.on('backupSystem', async () => {
    try {
      // Yedekleme dizininin varlığını kontrol et
      checkAndCreateDir(backupPath);

      // İşlem tarihi oluştur
      const now = new Date();
      const dateStr = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');

      // Veri yedekleme dosyaları
      const dataBackupPath = path.join(backupPath, 'music_system_data.json');
      const codeBackupPath = path.join(backupPath, `music_system_full_backup_${dateStr}.zip`);
      
      // Mevcut veri yedeklemelerini temizle
      if (fs.existsSync(dataBackupPath)) {
        fs.unlinkSync(dataBackupPath);
        console.log('Eski veri yedeği silindi.');
      }

      // Mevcut kod yedeklemelerini temizle
      const backupFiles = fs.readdirSync(backupPath).filter(file => file.startsWith('music_system_full_backup_') && file.endsWith('.zip'));
      for (const file of backupFiles) {
        fs.unlinkSync(path.join(backupPath, file));
        console.log(`Eski tam yedek silindi: ${file}`);
      }

      // Sistemin mevcut durumunu bir obje olarak tut
      const systemState = {
        songQueue,
        songHistory,
        chatHistory,
        headerColor,
        youtubeApiKey,
        backupDate: now.toISOString()
      };

      // Verileri JSON formatında kaydet
      fs.writeFileSync(
        dataBackupPath,
        JSON.stringify(systemState, null, 2)
      );
      console.log('Sistem verileri yedeklendi:', dataBackupPath);

      // Proje kök dizinini al
      const projectRoot = path.resolve(__dirname, '..');

      // Kök dizinin ZIP arşivini oluştur
      await zipDirectory(projectRoot, codeBackupPath);
      console.log('Tam proje yedeği oluşturuldu:', codeBackupPath);

      socket.emit('backupCompleted', { 
        success: true, 
        message: 'Sistem başarıyla yedeklendi. Hem veriler hem de kod arşivlendi.', 
        dataPath: dataBackupPath,
        codePath: codeBackupPath,
        date: systemState.backupDate
      });
    } catch (error) {
      console.error('Yedekleme sırasında hata:', error);
      socket.emit('backupCompleted', { 
        success: false, 
        message: 'Yedekleme işlemi sırasında bir hata oluştu: ' + error.message 
      });
    }
  });

  // Sistem verilerini geri yükleme
  socket.on('restoreSystem', () => {
    try {
      const dataBackupPath = path.join(backupPath, 'music_system_data.json');
      
      if (!fs.existsSync(dataBackupPath)) {
        socket.emit('restoreCompleted', { 
          success: false, 
          message: 'Yedek dosyası bulunamadı.' 
        });
        return;
      }

      // Yedek dosyasını oku
      const backupData = fs.readFileSync(dataBackupPath, 'utf8');
      const systemState = JSON.parse(backupData);

      // Veri tabanını güncelle
      songQueue = systemState.songQueue || [];
      songHistory = systemState.songHistory || [];
      chatHistory = systemState.chatHistory || [];
      headerColor = systemState.headerColor || '#212529';
      youtubeApiKey = systemState.youtubeApiKey || '';

      // Güncellenen bilgileri tüm istemcilere yayınla
      io.emit('updateSongQueue', songQueue);
      io.emit('updateSongHistory', songHistory);
      io.emit('updateChatHistory', chatHistory);
      io.emit('updateHeaderColor', headerColor);
      io.emit('updateSettings', { youtubeApiKey });

      console.log('Sistem verileri geri yüklendi.');
      socket.emit('restoreCompleted', { 
        success: true, 
        message: 'Sistem başarıyla geri yüklendi.' 
      });
    } catch (error) {
      console.error('Geri yükleme sırasında hata:', error);
      socket.emit('restoreCompleted', { 
        success: false, 
        message: 'Geri yükleme işlemi sırasında bir hata oluştu: ' + error.message 
      });
    }
  });

  // Sistemi yeniden başlatma
  socket.on('restartSystem', () => {
    try {
      console.log('Sistem yeniden başlatılıyor...');
      socket.emit('restartInitiated', { 
        success: true, 
        message: 'Sistem yeniden başlatılıyor. Lütfen bekleyin...' 
      });

      // Güvenli bir şekilde tüm bağlantıları kapatıp uygulamayı yeniden başlat
      setTimeout(() => {
        // Önce bağlantıları kapat
        io.close(() => {
          // Daha sonra process'i yeniden başlat
          exec('npm restart', (error, stdout, stderr) => {
            if (error) {
              console.error(`Yeniden başlatma hatası: ${error}`);
              return;
            }
            console.log(`Yeniden başlatma çıktısı: ${stdout}`);
          });
        });
      }, 2000);
    } catch (error) {
      console.error('Yeniden başlatma sırasında hata:', error);
      socket.emit('restartInitiated', { 
        success: false, 
        message: 'Yeniden başlatma işlemi sırasında bir hata oluştu: ' + error.message 
      });
    }
  });
});

// YouTube video ID'sini URL'den çıkarma yardımcı fonksiyonu
function getYoutubeId(url) {
  if (!url) return null;
  
  // Direkt olarak ID gönderilmişse
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }
  
  // YouTube URL'sinden ID çıkar
  const regExp = /^.*(?:youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  
  return match && match[1].length === 11 ? match[1] : null;
}

// Şarkıyı çalma yardımcı fonksiyonu
function playSong(songId) {
  // Çalınacak şarkıyı bul
  const songIndex = songQueue.findIndex(song => song.id === songId);
  
  if (songIndex >= 0) {
    // Şarkıyı sıradan çıkar
    currentSong = songQueue.splice(songIndex, 1)[0];
    
    // Şarkı geçmişine ekle
    songHistory.unshift(currentSong);
    
    // Çalan şarkıyı güncelle
    io.emit('updateCurrentSong', currentSong);
    
    // Şarkı sırasını güncelle
    io.emit('updateSongQueue', songQueue);
    
    // Şarkı geçmişini güncelle
    io.emit('updateSongHistory', songHistory);
    
    console.log(`Şarkı çalınıyor: ${currentSong.song} - İsteyen: ${currentSong.requestedBy}`);
  }
}

// Bir sonraki şarkıyı çalma yardımcı fonksiyonu
function playNextSong() {
  if (songQueue.length > 0) {
    // Sıradaki ilk şarkıyı çal
    playSong(songQueue[0].id);
  } else {
    // Sırada şarkı yoksa çalanı temizle
    currentSong = null;
    io.emit('updateCurrentSong', null);
    console.log('Sırada şarkı kalmadı');
  }
}

// YouTube API key alma endpoint'i
app.get('/api/settings/youtube-api-key', (req, res) => {
  res.json({ youtubeApiKey });
});

// YouTube API key güncelleme endpoint'i
app.post('/api/settings/youtube-api-key', (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (apiKey) {
      youtubeApiKey = apiKey;
      io.emit('updateSettings', { youtubeApiKey });
      console.log('YouTube API Key güncellendi');
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: 'API Key boş olamaz' });
    }
  } catch (error) {
    console.error('API Key güncellenirken hata:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// YouTube Video Bilgisi alma endpoint'i
app.get('/api/youtube/video-info/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    if (!youtubeApiKey) {
      return res.status(400).json({ success: false, error: 'YouTube API key not configured' });
    }
    
    const videoDetails = await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${youtubeApiKey}`);
    
    if (videoDetails.data.items && videoDetails.data.items.length > 0) {
      // Video başlığını al
      const title = videoDetails.data.items[0].snippet.title;
      
      // Video süresini al ve biçimlendir
      const duration = videoDetails.data.items[0].contentDetails.duration;
      // ISO 8601 formatındaki süreyi dönüştür (PT1H2M3S -> 1:02:03)
      const formattedDuration = duration.replace(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/, (_, h, m, s) => {
        const hours = h ? h + ':' : '';
        const minutes = m ? (h && m.length === 1 ? '0' + m : m) + ':' : h ? '00:' : '';
        const seconds = s ? (s.length === 1 ? '0' + s : s) : '00';
        return hours + minutes + seconds;
      });
      
      return res.json({ title, duration: formattedDuration });
    } else {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
  } catch (error) {
    console.error('Video bilgisi alınırken hata:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// YouTube Playlist API Endpoint'i - Bütün playlistleri almak için
app.get('/api/youtube/playlist/:playlistId', async (req, res) => {
  try {
    const { playlistId } = req.params;
    
    if (!youtubeApiKey) {
      return res.status(400).json({ success: false, error: 'YouTube API key not configured' });
    }
    
    // Tüm videoları toplamak için dizi
    const videos = [];
    let nextPageToken = null;
    
    // Tüm sayfaları alalım (1000 video sınırı)
    do {
      // Sayfa token'ı varsa onu kullan
      const params = {
        part: 'snippet',
        maxResults: 50, // Her sayfa için maksimum 50 video
        playlistId: playlistId,
        key: youtubeApiKey
      };
      
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }
      
      // Playlist API isteği
      const playlistResponse = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', { params });
      
      if (!playlistResponse.data || !playlistResponse.data.items) {
        break;  // Veri yoksa döngüden çık
      }
      
      // Bu sayfadaki videoları işle
      for (const item of playlistResponse.data.items) {
        if (item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId) {
          const videoId = item.snippet.resourceId.videoId;
          const title = item.snippet.title;
          
          // Her video için süre bilgisini al
          try {
            const videoResponse = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
              params: {
                part: 'contentDetails,snippet',
                id: videoId,
                key: youtubeApiKey
              }
            });
            
            if (videoResponse.data && videoResponse.data.items && videoResponse.data.items.length > 0) {
              const duration = videoResponse.data.items[0].contentDetails.duration;
              // ISO 8601 formatındaki süreyi dönüştür (PT1H2M3S -> 1:02:03)
              const formattedDuration = duration.replace(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/, (_, h, m, s) => {
                const hours = h ? h + ':' : '';
                const minutes = m ? (h && m.length === 1 ? '0' + m : m) + ':' : '00:';
                const seconds = s ? (s.length === 1 ? '0' + s : s) : '00';
                return hours + minutes + seconds;
              });
              
              videos.push({
                id: Date.now() + '-' + videoId,
                videoId: videoId,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                title: title,
                duration: formattedDuration
              });
            }
          } catch (videoError) {
            console.error('Video detayları alınamadı:', videoError);
            // Hata durumunda bile videoyu ekle ama süresiz
            videos.push({
              id: Date.now() + '-' + videoId,
              videoId: videoId,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              title: title,
              duration: 'Bilinmiyor'
            });
          }
        }
        
        // 1000 video sınırına ulaşıldı mı kontrol et
        if (videos.length >= 1000) {
          break;
        }
      }
      
      // Sonraki sayfa token'ını güncelle
      nextPageToken = playlistResponse.data.nextPageToken;
      
      // 1000 video sınırına ulaşıldı mı kontrol et
      if (videos.length >= 1000) {
        break;
      }
      
    } while (nextPageToken); // Sonraki sayfa varsa devam et
    
    return res.json({ 
      success: true, 
      videos: videos,
      count: videos.length,
      message: videos.length >= 1000 ? 'Maximum 1000 video limit reached' : `${videos.length} videos loaded`
    });
    
  } catch (error) {
    console.error('Playlist işlenirken hata:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// URL'den playlist ID çıkarma endpoint'i
app.post('/api/youtube/utils/extract-playlist-id', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL parametresi gerekli' });
  }
  
  // URL'den playlist ID'sini çıkar
  const regExp = /[&?]list=([a-zA-Z0-9_-]+)/;
  const match = url.match(regExp);
  
  if (match && match[1]) {
    return res.json({ success: true, playlistId: match[1] });
  } else {
    return res.json({ success: false, error: 'Playlist ID bulunamadı' });
  }
});

// Yedekleme dizini alma endpoint'i
app.get('/api/settings/backup-path', (req, res) => {
  res.json({ backupPath });
});

// Server'ı başlat
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});