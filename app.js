App({
  globalData: {
    todayStr: '',
    fragments: [],
    cards: [],
    apiKey: '',
    userId: '',
    lastSync: ''
  },

  onLaunch() {
    this.initToday();
    this.initUserId();
    this.loadLocal();
  },

  initToday() {
    var d = new Date();
    this.globalData.todayStr = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  },

  initUserId() {
    var stored = wx.getStorageSync('thinkprism_userId');
    if (stored) {
      this.globalData.userId = stored;
    } else {
      this.globalData.userId = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      wx.setStorageSync('thinkprism_userId', this.globalData.userId);
    }
  },

  saveLocal() {
    try {
      wx.setStorageSync('thinkprism_fragments', this.globalData.fragments);
      wx.setStorageSync('thinkprism_cards', this.globalData.cards);
      wx.setStorageSync('thinkprism_lastSync', this.globalData.lastSync);
    } catch (e) {
      console.error('saveLocal failed:', e);
    }
  },

  loadLocal() {
    try {
      this.globalData.fragments = wx.getStorageSync('thinkprism_fragments') || [];
      this.globalData.cards = wx.getStorageSync('thinkprism_cards') || [];
      this.globalData.lastSync = wx.getStorageSync('thinkprism_lastSync') || '';
      this.globalData.apiKey = wx.getStorageSync('thinkprism_apiKey') || '';
    } catch (e) {
      console.error('loadLocal failed:', e);
      this.globalData.fragments = [];
      this.globalData.cards = [];
    }
  }
});
