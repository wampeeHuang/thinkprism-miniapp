function getConfig() {
  return {
    url: wx.getStorageSync('thinkprism_sbUrl') || '',
    key: wx.getStorageSync('thinkprism_sbKey') || ''
  };
}

function sbHeaders() {
  var cfg = getConfig();
  return {
    'Content-Type': 'application/json',
    'apikey': cfg.key,
    'Authorization': 'Bearer ' + cfg.key
  };
}

function query(fragment, opts) {
  var url = getConfig().url + '/rest/v1/' + fragment + '?' + opts;
  return new Promise(function(resolve, reject) {
    wx.request({
      url: url, method: 'GET', header: sbHeaders(), timeout: 15000,
      success: function(r) { resolve(r.data || []); },
      fail: reject
    });
  });
}

function insert(table, data) {
  return new Promise(function(resolve, reject) {
    wx.request({
      url: getConfig().url + '/rest/v1/' + table,
      method: 'POST',
      header: Object.assign({}, sbHeaders(), { Prefer: 'resolution=merge-duplicates' }),
      data: data,
      timeout: 15000,
      success: function(r) { resolve(r.statusCode >= 200 && r.statusCode < 300); },
      fail: reject
    });
  });
}

function fetchFragments(userId, since) {
  var opts = 'select=*&user_id=eq.' + encodeURIComponent(userId) + '&order=timestamp.desc&limit=500';
  if (since) opts += '&timestamp=gt.' + encodeURIComponent(since);
  return query('fragments', opts);
}

function pushFragment(fragment, userId) {
  fragment.user_id = userId;
  return insert('fragments', fragment);
}

function fetchCards(userId) {
  var opts = 'select=*&user_id=eq.' + encodeURIComponent(userId) + '&order=date.desc&limit=100';
  return query('cards', opts);
}

function saveCard(card, userId) {
  card.user_id = userId;
  return insert('cards', card);
}

module.exports = { fetchFragments, pushFragment, fetchCards, saveCard };
