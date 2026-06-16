const { fetchFragments, pushFragment, saveCard, fetchCards } = require('../../utils/supabase.js');
const { generateCard } = require('../../utils/deepseek.js');
var shardAudioCtx = null;

Page({
  data: {
    currentDate: '',
    displayDate: '',
    isToday: true,
    card: null,
    dayFragments: [],
    generating: false,
    toneColors: { lilac: '#9A8FB5', lemon: '#F2CC8F', blush: '#E6B89C', pink: '#E07A5F', sage: '#81B29A' }
  },

  onLoad(options) {
    var date = (options && options.date) ? options.date : app.globalData.todayStr;
    this.setData({ currentDate: date });
    this.loadDay();
  },

  onShow() {
    this.loadDay();
  },

  playVoice(e) {
    var path = e.currentTarget.dataset.path;
    if (!path) return;
    if (shardAudioCtx) { shardAudioCtx.destroy(); }
    shardAudioCtx = wx.createInnerAudioContext();
    shardAudioCtx.obeyMuteSwitch = false;
    shardAudioCtx.src = path;
    shardAudioCtx.play();
    shardAudioCtx.onError(function(err) {
      wx.showToast({ title: '播放失败', icon: 'none' });
    });
  },

  loadDay() {
    var d = this.data.currentDate;
    this.setData({ isToday: d === app.globalData.todayStr });
    this.setData({ displayDate: d });

    var frags = (app.globalData.fragments || []).filter(function(f) {
      return f.timestamp && f.timestamp.startsWith(d);
    });

    var cards = (app.globalData.cards || []).filter(function(c) {
      return c.date === d;
    });

    this.setData({
      dayFragments: frags,
      card: cards.length > 0 ? cards[0] : null
    });
  },

  prevDay() {
    var cur = this.data.currentDate;
    var parts = cur.split('-');
    var prev = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    prev.setDate(prev.getDate() - 1);
    var newDate = prev.getFullYear() + '-' +
      String(prev.getMonth() + 1).padStart(2, '0') + '-' +
      String(prev.getDate()).padStart(2, '0');
    this.setData({ currentDate: newDate });
    this.loadDay();
  },

  nextDay() {
    if (this.data.isToday) return;
    var cur = this.data.currentDate;
    var parts = cur.split('-');
    var next = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    next.setDate(next.getDate() + 1);
    var newDate = next.getFullYear() + '-' +
      String(next.getMonth() + 1).padStart(2, '0') + '-' +
      String(next.getDate()).padStart(2, '0');
    if (newDate > app.globalData.todayStr) return;
    this.setData({ currentDate: newDate });
    this.loadDay();
  },

  generateCardForDay() {
    var that = this;
    this.setData({ generating: true });

    generateCard(this.data.dayFragments, app.globalData.apiKey).then(function(result) {
      var card = {
        date: that.data.currentDate,
        generated_at: new Date().toISOString(),
        summary: result.summary || { tone: 'sage', theme: '空白的一天', overview: '没有记录碎片。' },
        refraction: result.refraction || { tone: 'lilac', perspective: '涌现', theme: '空白折射', insight: '没有碎片的一天，也是一天。' }
      };

      var cards = app.globalData.cards || [];
      cards = [card].concat(cards.filter(function(c) { return c.date !== card.date; }));
      app.globalData.cards = cards;
      app.saveLocal();

      saveCard(card, app.globalData.userId).catch(function() {});

      that.setData({ card: card, generating: false });
    }).catch(function(err) {
      that.setData({ generating: false });
      wx.showToast({ title: '生成失败: ' + (err.message || '网络错误'), icon: 'none' });
    });
  }
});
