const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Basit bir test endpoint'i
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend API çalışıyor!' });
});

// Şarkı sırası ve aktif kullanıcılar için hafıza içi depolama
let songQueue = [];
let activeUsers = [];
let currentSong = null;

// Socket.io bağlantıları
io.on('connection', (socket) => {
  console.log('Yeni kullanıcı bağlandı:', socket.id);
  
  // Yeni kullanıcıya mevcut durumu gönder
  socket.emit('initialState', {
    songQueue,
    currentSong,
    activeUsers
  });
  
  // Kullanıcı adı ayarlama
  socket.on('setUsername', (username) => {
    console.log(`Kullanıcı adı ayarlandı: ${username} (${socket.id})`);
    const user = {
      id: socket.id,
      username,
      joinedAt: new Date()
    };
    
    activeUsers.push(user);
    io.emit('userJoined', user);
    io.emit('updateActiveUsers', activeUsers);
  });
  
  // Şarkı istekleri
  socket.on('requestSong', (songRequest) => {
    console.log('Şarkı isteği alındı:', songRequest);
    const request = {
      id: Date.now().toString(),
      song: songRequest,
      requestedBy: activeUsers.find(user => user.id === socket.id)?.username || 'Misafir',
      requestedAt: new Date()
    };
    
    songQueue.push(request);
    io.emit('updateSongQueue', songQueue);
  });
  
  // Sohbet mesajları
  socket.on('chatMessage', (message) => {
    const user = activeUsers.find(user => user.id === socket.id);
    const chatMessage = {
      id: Date.now().toString(),
      text: message,
      sender: user?.username || 'Misafir',
      timestamp: new Date()
    };
    
    io.emit('newChatMessage', chatMessage);
  });
  
  // Admin kontrolü: Şarkı çalma
  socket.on('playSong', (songId) => {
    const songToPlay = songQueue.find(song => song.id === songId);
    if (songToPlay) {
      currentSong = songToPlay;
      songQueue = songQueue.filter(song => song.id !== songId);
      io.emit('updateCurrentSong', currentSong);
      io.emit('updateSongQueue', songQueue);
    }
  });
  
  // Admin kontrolü: Şarkıyı durdur
  socket.on('stopSong', () => {
    currentSong = null;
    io.emit('updateCurrentSong', currentSong);
  });
  
  // Bağlantı kesildiğinde
  socket.on('disconnect', () => {
    console.log('Kullanıcı bağlantısı kesildi:', socket.id);
    activeUsers = activeUsers.filter(user => user.id !== socket.id);
    io.emit('updateActiveUsers', activeUsers);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Sunucu port ${PORT} üzerinde çalışıyor`);
});