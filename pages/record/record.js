const app = getApp();
const { fetchFragments, pushFragment } = require('../../utils/supabase.js');
const { generateCard } = require('../../utils/deepseek.js');

var audioCtx = null;
var recorder = null;

Page({
  data: {
    todayStr: '',
    todayCard: null,
    todayFragments: [],
    recording: false,
    inputText: '',
    showTextInput: false,
    generating: false,
    syncing: false,
    lastSync: '',
    keyboardHeight: 0,
    lastVoicePath: '',
    // Calendar
    showCalendar: false,
    calYear: 2026,
    calMonth: 6,
    calWeeks: [],
    calSelectedDate: '',
    calFragments: [],
    calCard: null,
    toneColors: { lilac: '#9A8FB5', lemon: '#F2CC8F', blush: '#E6B89C', pink: '#E07A5F', sage: '#81B29A' }
  },

  onLoad() {
    this.setData({ todayStr: app.globalData.todayStr });
    this.setupRecorder();
    this.loadToday();
  },

  onShow() {
    this.loadToday();
  },

  setupRecorder() {
    var that = this;
    recorder = wx.getRecorderManager();

    recorder.onStop(function(res) {
      that.setData({ recording: false });
      if (res.tempFilePath) {
        that.saveVoiceEntry(res.tempFilePath);
      }
    });

    recorder.onError(function(err) {
      that.setData({ recording: false });
      wx.showToast({ title: '录音失败: ' + (err.errMsg || '权限未授权'), icon: 'none', duration: 3000 });
    });
  },

  loadToday() {
    var today = app.globalData.todayStr;
    var frags = (app.globalData.fragments || []).filter(function(f) {
      return f.timestamp && f.timestamp.startsWith(today);
    });
    var cards = (app.globalData.cards || []).filter(function(c) {
      return c.date === today;
    });
    this.setData({
      todayStr: today,
      todayFragments: frags,
      todayCard: cards.length > 0 ? cards[0] : null
    });
    this.syncSupabase();
  },

  syncSupabase() {
    var that = this;
    this.setData({ syncing: true });
    var since = app.globalData.lastSync;
    var d = new Date();
    var nowISO = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + 'T' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0');

    var userId = app.globalData.userId;
    fetchFragments(userId, since).then(function(remote) {
      if (!remote || remote.length === 0) {
        that.setData({ syncing: false, lastSync: nowISO.slice(11, 19) });
        return;
      }
      var existing = app.globalData.fragments || [];
      var idMap = {};
      existing.forEach(function(f) { idMap[f.id] = true; });
      var merged = existing.slice();
      var added = 0;
      remote.forEach(function(f) {
        if (!idMap[f.id]) {
          merged.push(f);
          idMap[f.id] = true;
          added++;
        }
      });
      if (added > 0) {
        merged.sort(function(a, b) {
          return (b.timestamp || '').localeCompare(a.timestamp || '');
        });
        app.globalData.fragments = merged;
        app.saveLocal();
        that.loadToday();
      }
      app.globalData.lastSync = nowISO;
      that.setData({ syncing: false, lastSync: nowISO.slice(11, 19) });
    }).catch(function() {
      that.setData({ syncing: false });
    });
  },

  /* ---- Vinyl Hero Interaction ---- */
  onTouchStart() {
    if (this.data.recording) return;
    var that = this;
    this._pressFired = false;
    this._ignoreNextTap = false;
    this._pressTimer = setTimeout(function() {
      that._pressFired = true;
      that._ignoreNextTap = true;
      that.startRecord();
    }, 2000);
  },

  onTouchEnd() {
    if (this._pressTimer) {
      clearTimeout(this._pressTimer);
      this._pressTimer = null;
    }
  },

  onVinylTap() {
    if (this.data.recording) {
      if (this._ignoreNextTap) {
        this._ignoreNextTap = false;
        return;
      }
      this.stopRecord();
      return;
    }
    if (this._pressFired) {
      this._pressFired = false;
      return;
    }
    this.setData({ showTextInput: true, inputText: '' });
  },

  /* ---- Import (+ button in text sheet) ---- */
  onImportTap() {
    var that = this;
    wx.showActionSheet({
      itemList: ['拍照/相册', '从微信导入'],
      success: function(res) {
        if (res.tapIndex === 0) {
          that.fromCameraOrAlbum();
        } else {
          that.fromWeChat();
        }
      }
    });
  },

  fromCameraOrAlbum() {
    var that = this;
    wx.chooseMedia({
      count: 9, mediaType: ['image', 'video'], sourceType: ['album', 'camera'],
      success: function(res) {
        var files = res.tempFiles || [];
        if (files.length === 0) return;
        var fs = wx.getFileSystemManager();
        var saved = 0;
        files.forEach(function(file) {
          var d = new Date();
          var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' +
            String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
          var isVideo = file.fileType === 'video';

          var createFrag = function(persistPath) {
            var frag = {
              id: (isVideo ? 'vid_' : 'img_') + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
              content: isVideo ? '[视频]' : '[图片]',
              source: isVideo ? 'video' : 'image',
              timestamp: iso,
              imagePath: persistPath
            };
            app.globalData.fragments = [frag].concat(app.globalData.fragments || []);
            app.saveLocal();
            pushFragment(frag, app.globalData.userId).catch(function() {});
            saved++;
            if (saved === files.length) {
              wx.showToast({ title: files.length + ' 个文件已保存', icon: 'success', duration: 1500 });
              that.loadToday();
            }
          };

          fs.saveFile({
            tempFilePath: file.tempFilePath,
            success: function(r) { createFrag(r.savedFilePath); },
            fail: function() { createFrag(file.tempFilePath); }
          });
        });
      }
    });
  },

  fromWeChat() {
    var that = this;
    wx.chooseMessageFile({
      count: 10, type: 'all',
      success: function(res) {
        var files = res.tempFiles || [];
        if (files.length === 0) return;
        var fs = wx.getFileSystemManager();
        var saved = 0;
        files.forEach(function(file) {
          var d = new Date();
          var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' +
            String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');

          var createFrag = function(persistPath) {
            var frag = {
              id: 'wx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
              content: '[微信] ' + (file.name || ''),
              source: 'file',
              timestamp: iso,
              filePath: persistPath,
              fileName: file.name
            };
            app.globalData.fragments = [frag].concat(app.globalData.fragments || []);
            app.saveLocal();
            pushFragment(frag, app.globalData.userId).catch(function() {});
            saved++;
            if (saved === files.length) {
              wx.showToast({ title: files.length + ' 个文件已导入', icon: 'success', duration: 1500 });
              that.loadToday();
            }
          };

          fs.saveFile({
            tempFilePath: file.path,
            success: function(r) { createFrag(r.savedFilePath); },
            fail: function() { createFrag(file.path); }
          });
        });
      }
    });
  },

  closeTextInput() {
    this.setData({ showTextInput: false, inputText: '', keyboardHeight: 0 });
  },

  onKeyboardHeightChange(e) {
    this.setData({ keyboardHeight: e.detail.height });
  },

  /* ---- Voice Recording ---- */
  startRecord() {
    if (this.data.recording) return;
    recorder.start({ duration: 60000, format: 'mp3' });
    this.setData({ recording: true });
  },

  stopRecord() {
    if (!this.data.recording) return;
    recorder.stop();
  },

  saveVoiceEntry(filePath) {
    var that = this;
    var d = new Date();
    var iso = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + 'T' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0');

    var content = '[语音] ' + iso.slice(11, 16);

    var createFrag = function(audioPath) {
      var frag = {
        id: 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        content: content,
        source: 'voice',
        timestamp: iso,
        audioPath: audioPath
      };
      app.globalData.fragments = [frag].concat(app.globalData.fragments || []);
      app.saveLocal();
      pushFragment(frag, app.globalData.userId).catch(function() {});
      wx.showToast({ title: '语音已保存', icon: 'success', duration: 1500 });
      that.setData({ lastVoicePath: audioPath });
      that.loadToday();
    };

    wx.getFileSystemManager().saveFile({
      tempFilePath: filePath,
      success: function(res) { createFrag(res.savedFilePath); },
      fail: function() { createFrag(filePath); }
    });
  },

  /* ---- Voice Playback ---- */
  playVoice(e) {
    var path = e.currentTarget.dataset.path;
    if (!path) return;
    if (audioCtx) { audioCtx.destroy(); }
    audioCtx = wx.createInnerAudioContext();
    audioCtx.obeyMuteSwitch = false;
    audioCtx.src = path;
    audioCtx.play();
    audioCtx.onError(function(err) {
      wx.showToast({ title: '播放失败: ' + (err.errMsg || ''), icon: 'none' });
    });
  },

  /* ---- Text Input ---- */
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  submitText() {
    var text = this.data.inputText.trim();
    if (!text) return;
    var that = this;
    var d = new Date();
    var iso = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + 'T' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0');
    var frag = {
      id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      content: text,
      source: 'text',
      timestamp: iso
    };
    app.globalData.fragments = [frag].concat(app.globalData.fragments || []);
    app.saveLocal();
    pushFragment(frag, app.globalData.userId).catch(function() {});
    this.setData({ inputText: '', showTextInput: false });
    this.loadToday();
  },

  /* ---- + Button ---- */
  onPlusTap() {
    var that = this;
    wx.showActionSheet({
      itemList: ['链接', '图片', '文件', '聊天'],
      success: function(res) {
        var idx = res.tapIndex;
        if (idx === 0) that.fromClipboard();
        else if (idx === 1) that.fromImage();
        else if (idx === 2) that.fromFile();
        else if (idx === 3) that.fromChat();
      }
    });
  },

  fromClipboard() {
    var that = this;
    wx.getClipboardData({
      success: function(cb) {
        var text = (cb.data || '').trim();
        if (!text) { wx.showToast({ title: '剪贴板为空', icon: 'none' }); return; }
        that.setData({ inputText: text });
        that.submitText();
      },
      fail: function() { wx.showToast({ title: '无法读取剪贴板', icon: 'none' }); }
    });
  },

  fromImage() {
    var that = this;
    wx.chooseMedia({
      count: 9, mediaType: ['image'], sourceType: ['album', 'camera'],
      success: function(res) {
        var files = res.tempFiles || [];
        files.forEach(function(file) {
          var d = new Date();
          var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' +
            String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
          var frag = { id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), content: '[图片]', source: 'image', timestamp: iso, imagePath: file.tempFilePath };
          app.globalData.fragments = [frag].concat(app.globalData.fragments || []);
          app.saveLocal();
          pushFragment(frag, app.globalData.userId).catch(function() {});
        });
        wx.showToast({ title: files.length + ' 张图片已保存', icon: 'success', duration: 1500 });
        that.loadToday();
      }
    });
  },

  fromFile() {
    var that = this;
    wx.chooseMessageFile({
      count: 10, type: 'all',
      success: function(res) {
        var files = res.tempFiles || [];
        files.forEach(function(file) {
          var d = new Date();
          var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' +
            String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
          var frag = { id: 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), content: '[文件] ' + (file.name || ''), source: 'file', timestamp: iso, filePath: file.path, fileName: file.name };
          app.globalData.fragments = [frag].concat(app.globalData.fragments || []);
          app.saveLocal();
          pushFragment(frag, app.globalData.userId).catch(function() {});
        });
        wx.showToast({ title: files.length + ' 个文件已导入', icon: 'success', duration: 1500 });
        that.loadToday();
      }
    });
  },

  fromChat() {
    var that = this;
    wx.chooseMessageFile({
      count: 10, type: 'file',
      success: function(res) {
        var files = res.tempFiles || [];
        files.forEach(function(file) {
          var d = new Date();
          var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' +
            String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
          var frag = { id: 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), content: '[聊天文件] ' + (file.name || ''), source: 'chat', timestamp: iso, filePath: file.path, fileName: file.name };
          app.globalData.fragments = [frag].concat(app.globalData.fragments || []);
          app.saveLocal();
          pushFragment(frag, app.globalData.userId).catch(function() {});
        });
        wx.showToast({ title: files.length + ' 个聊天文件已导入', icon: 'success', duration: 1500 });
        that.loadToday();
      }
    });
  },

  /* ---- Card Generation ---- */
  generateTodayCard() {
    var that = this;
    var hasCard = !!this.data.todayCard;
    if (hasCard) {
      wx.showModal({
        title: '重新折光',
        content: '今天的折光已经生成过，重新生成会覆盖当前卡片。确定继续？',
        success: function(res) {
          if (res.confirm) { that._doGenerate(); }
        }
      });
    } else {
      this._doGenerate();
    }
  },

  _doGenerate() {
    var that = this;
    this.setData({ generating: true });

    generateCard(this.data.todayFragments, app.globalData.apiKey).then(function(result) {
      var card = {
        date: app.globalData.todayStr,
        generated_at: new Date().toISOString(),
        summary: result.summary || { tone: 'sage', theme: '空白的一天', overview: '今天没有记录碎片。', excerpts: [] },
        refraction: result.refraction || { tone: 'lilac', perspective: '涌现', theme: '空白折射', insight: '没有碎片的一天，也是一天。', question: '今天有什么是你注意到了但没有记下来的？' }
      };

      var cards = app.globalData.cards || [];
      cards = [card].concat(cards.filter(function(c) { return c.date !== card.date; }));
      app.globalData.cards = cards;
      app.saveLocal();
      wx.setStorageSync('thinkprism_card_' + card.date, card);

      var saveCardModule = require('../../utils/supabase.js');
      saveCardModule.saveCard(card, app.globalData.userId).catch(function() {});

      that.setData({ todayCard: card, generating: false });
    }).catch(function(err) {
      that.setData({ generating: false });
      wx.showToast({ title: '生成失败: ' + (err.message || '网络错误'), icon: 'none' });
    });
  },

  /* ---- Navigation ---- */
  goToShard() {
    wx.navigateTo({ url: '/pages/shard/shard' });
  },

  goToShardDate(e) {
    var date = e.currentTarget.dataset.date;
    if (!date) return;
    wx.navigateTo({ url: '/pages/shard/shard?date=' + date });
  },

  /* ---- Calendar ---- */
  openCalendar() {
    var today = this.data.todayStr;
    var parts = today.split('-');
    var y = parseInt(parts[0]), m = parseInt(parts[1]);
    this.setData({ showCalendar: true, calSelectedDate: today });
    this.buildCalendar(y, m);
  },

  closeCalendar() {
    this.setData({ showCalendar: false });
    this.loadToday();
  },

  calSelectDate(e) {
    var date = e.currentTarget.dataset.date;
    this.setData({ calSelectedDate: date });
    this.loadCalFragments(date);
  },

  calPrevMonth() {
    var y = this.data.calYear, m = this.data.calMonth;
    if (m === 1) { y--; m = 12; } else { m--; }
    this.buildCalendar(y, m);
  },

  calNextMonth() {
    var y = this.data.calYear, m = this.data.calMonth;
    if (m === 12) { y++; m = 1; } else { m++; }
    this.buildCalendar(y, m);
  },

  buildCalendar(year, month) {
    var firstDay = new Date(year, month - 1, 1).getDay();
    var daysInMonth = new Date(year, month, 0).getDate();
    var today = app.globalData.todayStr;

    var fragments = app.globalData.fragments || [];
    var cards = app.globalData.cards || [];

    var dayCounts = {};
    fragments.forEach(function(f) {
      var d = f.timestamp ? f.timestamp.slice(0, 10) : '';
      if (d) dayCounts[d] = (dayCounts[d] || 0) + 1;
    });

    var cardTones = {};
    cards.forEach(function(c) {
      if (c.date) {
        cardTones[c.date] = c.summary ? c.summary.tone : (c.tone || null);
      }
    });

    var weeks = [];
    var week = [];
    for (var i = 0; i < firstDay; i++) { week.push(null); }

    for (var d = 1; d <= daysInMonth; d++) {
      var ds = year + '-' + String(month).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var count = dayCounts[ds] || 0;
      var tone = cardTones[ds] || null;
      week.push({
        day: d, date: ds, count: count, tone: tone,
        isToday: ds === today,
        hasData: count > 0,
        dotOpacity: count > 0 ? (0.3 + Math.min(count, 12) * 0.06).toFixed(2) : 0,
        dotSize: count > 0 ? Math.min(14, 6 + count * 1.2).toFixed(0) : 0
      });
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    this.setData({ calYear: year, calMonth: month, calWeeks: weeks });
    this.loadCalFragments(this.data.calSelectedDate);
  },

  loadCalFragments(dateStr) {
    var frags = (app.globalData.fragments || []).filter(function(f) {
      return f.timestamp && f.timestamp.startsWith(dateStr);
    });
    var cards = (app.globalData.cards || []).filter(function(c) {
      return c.date === dateStr;
    });
    this.setData({
      calSelectedDate: dateStr,
      calFragments: frags,
      calCard: cards.length > 0 ? cards[0] : null
    });
  }
});
