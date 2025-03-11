// frontend/src/services/PlayerService.js
import axios from 'axios';

class PlayerService {
  constructor() {
    this.apiKey = null;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  async searchYouTube(query) {
    if (!this.apiKey || !query) {
      return null;
    }

    try {
      const response = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
        params: {
          part: 'snippet',
          maxResults: 1,
          q: query,
          type: 'video',
          key: this.apiKey
        }
      });

      if (response.data && response.data.items && response.data.items.length > 0) {
        const videoId = response.data.items[0].id.videoId;
        return videoId;
      }
    } catch (error) {
      console.error('YouTube arama hatası:', error);
    }
    return null;
  }

  async getVideoDetails(videoId) {
    if (!this.apiKey || !videoId) {
      return null;
    }

    try {
      const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
        params: {
          part: 'snippet,contentDetails',
          id: videoId,
          key: this.apiKey
        }
      });

      if (response.data && response.data.items && response.data.items.length > 0) {
        return response.data.items[0];
      }
    } catch (error) {
      console.error('Video detay hatası:', error);
    }
    return null;
  }
}

export default new PlayerService();