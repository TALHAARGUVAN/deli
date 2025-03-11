// frontend/src/contexts/TitleContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import io from 'socket.io-client';

const ENDPOINT = 'http://localhost:5000';
let socket;

const TitleContext = createContext();

export const TitleProvider = ({ children }) => {
  const [title, setTitle] = useState('Müzik İstek Platformu');
  const [headerColor, setHeaderColor] = useState('#212529');
  
  useEffect(() => {
    // Eğer socket zaten oluşturulmuşsa tekrar oluşturma
    if (!socket || !socket.connected) {
      socket = io(ENDPOINT);
      
      // Socket bağlantı kontrolü
      socket.on('connect', () => {
        console.log('TitleContext: Socket.io bağlantısı kuruldu!');
      });
    }
    
    // Başlık bilgisini al
    socket.on('initialState', (state) => {
      console.log('TitleContext: initialState alındı', state);
      if (state.title) {
        setTitle(state.title);
      }
      if (state.headerColor) {
        setHeaderColor(state.headerColor);
      }
    });
    
    // Başlık güncellendiğinde
    socket.on('updateTitle', (newTitle) => {
      console.log('TitleContext: Başlık güncellendi', newTitle);
      setTitle(newTitle);
    });
    
    // Header rengi güncellendiğinde
    socket.on('updateHeaderColor', (color) => {
      console.log('TitleContext: Header rengi güncellendi', color);
      setHeaderColor(color);
    });
    
    return () => {
      // Component unmount olduğunda socket'i kapatmıyoruz
      // Çünkü diğer componentler hala kullanabilir
    };
  }, []);

  const updateTitle = (newTitle) => {
    if (newTitle && newTitle.trim() !== '') {
      // Eğer socket oluşturulmamışsa oluştur
      if (!socket || !socket.connected) {
        socket = io(ENDPOINT);
      }
      
      console.log('TitleContext: updateTitle çağrıldı', newTitle);
      socket.emit('updateTitle', newTitle.trim());
      setTitle(newTitle.trim());
    }
  };
  
  const updateHeaderColor = (color) => {
    if (color) {
      // Eğer socket oluşturulmamışsa oluştur
      if (!socket || !socket.connected) {
        socket = io(ENDPOINT);
      }
      
      console.log('TitleContext: updateHeaderColor çağrıldı', color);
      socket.emit('updateHeaderColor', color);
      setHeaderColor(color);
    }
  };

  return (
    <TitleContext.Provider value={{ title, updateTitle, headerColor, updateHeaderColor }}>
      {children}
    </TitleContext.Provider>
  );
};

export const useTitle = () => useContext(TitleContext);