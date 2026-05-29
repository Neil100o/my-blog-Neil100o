(function() {
  var path = location.pathname;
  var tx = document.getElementById('tx');
  var cl = document.getElementById('cl');
  var form = document.getElementById('cf');
  var btn = document.getElementById('sb');

  if (!form || !cl) return;

  function load() {
    fetch('/api/comments?path=' + encodeURIComponent(path))
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(d) {
        if (!d || !d.length) {
          cl.innerHTML = '<p style="color:#999">暂无评论，来抢沙发吧</p>';
          return;
        }
        var h = '';
        for (var i = 0; i < d.length; i++) {
          var c = d[i];
          var mail = c.email ? ' <small style="color:#999">(' + c.email + ')</small>' : '';
          h += '<div style="border-bottom:1px solid #eee;padding:1rem 0">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;flex-wrap:wrap">' +
              '<div><strong>' + c.author + '</strong>' + mail + '</div>' +
              '<small style="color:#999">' + new Date(c.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) + '</small>' +
            '</div>' +
            '<p style="margin:0;white-space:pre-wrap">' + c.content + '</p>' +
          '</div>';
        }
        cl.innerHTML = h;
      })
      .catch(function(e) {
        cl.innerHTML = '<p style="color:red">加载失败: ' + e.message + '</p>';
      });
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    e.stopPropagation();

    btn.disabled = true;
    btn.textContent = '提交中...';

    fetch('/api/comments?path=' + encodeURIComponent(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: form.author.value,
        email: form.email.value,
        content: tx.value
      })
    })
    .then(function(r) {
      if (!r.ok) {
        return r.json().then(function(err) { throw new Error(err.error || '提交失败'); });
      }
      return r.json();
    })
    .then(function() {
      form.reset();
      load();
      btn.disabled = false;
      btn.textContent = '提交评论';
    })
    .catch(function(err) {
      alert('提交失败: ' + err.message);
      btn.disabled = false;
      btn.textContent = '提交评论';
    });

    return false;
  });

  load();
  // 点赞功能
  (function() {
    var likeBtn = document.getElementById('like-btn');
    var likeCount = document.getElementById('like-count');
    var likeIcon = document.getElementById('like-icon');
    if (!likeBtn || !likeCount) return;

    function loadLike() {
      fetch('/api/like?path=' + encodeURIComponent(path))
        .then(function(r) { return r.json(); })
        .then(function(d) {
          likeCount.textContent = (d.count || 0) + ' 赞';
        })
        .catch(function() {
          likeCount.textContent = '0 赞';
        });
    }

    likeBtn.addEventListener('click', function() {
      likeBtn.disabled = true;
      fetch('/api/like?path=' + encodeURIComponent(path), { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          likeCount.textContent = (d.count || 0) + ' 赞';
          likeIcon.textContent = '♥';
          likeBtn.style.background = '#cc0000';
          likeBtn.style.color = '#fff';
          likeBtn.style.borderColor = '#cc0000';
        })
        .catch(function(err) {
          alert('点赞失败: ' + err.message);
          likeBtn.disabled = false;
        });
    });

    loadLike();
  })();
})();