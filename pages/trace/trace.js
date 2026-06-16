const app = getApp();
var traceAudioCtx = null;

Page({
  data: {
    filter: 'all',
    filteredFragments: [],
    groupedFragments: [],
    uniqueDates: []
  },

  onLoad() {
    this.buildView();
  },

  onShow() {
    this.buildView();
  },

  playVoice(e) {
    var path = e.currentTarget.dataset.path;
    if (!path) return;
    if (traceAudioCtx) { traceAudioCtx.destroy(); }
    traceAudioCtx = wx.createInnerAudioContext();
    traceAudioCtx.obeyMuteSwitch = false;
    traceAudioCtx.src = path;
    traceAudioCtx.play();
    traceAudioCtx.onError(function(err) {
      wx.showToast({ title: '播放失败', icon: 'none' });
    });
  },

  buildView() {
    var frags = app.globalData.fragments || [];
    var filter = this.data.filter;

    var filtered;
    if (filter === 'all') {
      filtered = frags;
    } else if (filter === 'jsonl') {
      filtered = frags.filter(function(f) { return f.source === 'jsonl'; });
    } else if (filter === 'self') {
      filtered = frags.filter(function(f) { return f.source === 'voice' || f.source === 'text'; });
    } else {
      filtered = frags;
    }

    // Group by date
    var groups = {};
    filtered.forEach(function(f) {
      var d = f.timestamp ? f.timestamp.slice(0, 10) : 'unknown';
      if (!groups[d]) groups[d] = [];
      groups[d].push(f);
    });

    var dates = Object.keys(groups).sort().reverse();
    var grouped = dates.map(function(d) {
      return {
        date: d,
        count: groups[d].length,
        fragments: groups[d].sort(function(a, b) {
          return (b.timestamp || '').localeCompare(a.timestamp || '');
        })
      };
    });

    this.setData({
      filteredFragments: filtered,
      groupedFragments: grouped,
      uniqueDates: dates
    });
  },

  setFilter(e) {
    var f = e.currentTarget.dataset.filter;
    this.setData({ filter: f });
    this.buildView();
  }
});
