(function() {
  var path = location.pathname;
  var tx = document.getElementById('comment-textarea');
  var cl = document.getElementById('cl');
  var form = document.getElementById('cf');
  var btn = document.getElementById('sb');

  if (!form || !cl) return;

  var quickEmojis = ['😀','😂','🤣','😭','😍','👍','🙏','💪','🎉','🔥','❤️','💀','☕','🍺'];

  function makeQuickEmojis(textarea) {
    var wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexWrap = 'wrap';
    wrap.style.gap = '0.3rem';
    for (var i = 0; i < quickEmojis.length; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.style.padding = '0.2rem 0.4rem';
      b.style.background = '#fff';
      b.style.border = '1.5px solid #000';
      b.style.borderRadius = '4px';
      b.style.cursor = 'pointer';
      b.style.fontSize = '1rem';
      b.style.minWidth = '2rem';
      b.style.minHeight = '1.8rem';
      b.textContent = quickEmojis[i];
      b.onmouseenter = function() { this.style.background = '#cc0000'; this.style.color = '#fff'; this.style.borderColor = '#cc0000'; };
      b.onmouseleave = function() { this.style.background = '#fff'; this.style.color = '#000'; this.style.borderColor = '#000'; };
      b.onclick = function() {
        var char = this.textContent;
        var start = textarea.selectionStart;
        var end = textarea.selectionEnd;
        var text = textarea.value;
        textarea.value = text.slice(0, start) + char + text.slice(end);
        textarea.focus();
        textarea.setSelectionRange(start + char.length, start + char.length);
      };
      wrap.appendChild(b);
    }
    return wrap;
  }

  function buildTree(list) {
    var map = {};
    var roots = [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      c.children = [];
      map[c.id] = c;
    }
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.parent_id && map[c.parent_id]) {
        map[c.parent_id].children.push(c);
      } else {
        roots.push(c);
      }
    }
    return roots;
  }

  function renderItem(c, depth) {
    var mail = c.email ? ' <small style="color:#999">(' + c.email + ')</small>' : '';
    var indentStyle = depth > 0 ? 'margin-left:' + (Math.min(depth, 2) * 1.2) + 'rem;border-left:2px solid #eee;padding-left:0.8rem;' : '';
    var replyBtn = '<button class="reply-btn" data-id="' + c.id + '" style="margin-top:0.5rem;padding:0.2rem 0.6rem;background:#fff;color:#000;border:1.5px solid #000;font-size:0.85rem;cursor:pointer;font-weight:600;">回复</button>';

    var html = '<div class="comment-item" data-id="' + c.id + '" style="border-bottom:1px solid #eee;padding:1rem 0;' + indentStyle + '">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;flex-wrap:wrap">' +
        '<div><strong>' + c.author + '</strong>' + mail + '</div>' +
        '<small style="color:#999">' + new Date(c.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) + '</small>' +
      '</div>' +
      '<p style="margin:0;white-space:pre-wrap">' + c.content + '</p>' +
      replyBtn +
      '<div class="reply-form-wrap" style="display:none;margin-top:0.8rem;"></div>' +
    '</div>';

    if (c.children && c.children.length) {
      for (var i = 0; i < c.children.length; i++) {
        html += renderItem(c.children[i], depth + 1);
      }
    }
    return html;
  }

  function bindReplyButtons() {
    var buttons = cl.querySelectorAll('.reply-btn');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', onReplyClick);
    }
  }

  function onReplyClick() {
    var btn = this;
    var parentId = btn.getAttribute('data-id');
    var wrap = btn.parentNode.querySelector('.reply-form-wrap');

    if (wrap.style.display === 'block') {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
      btn.textContent = '回复';
      return;
    }

    var allWraps = cl.querySelectorAll('.reply-form-wrap');
    var allBtns = cl.querySelectorAll('.reply-btn');
    for (var j = 0; j < allWraps.length; j++) {
      allWraps[j].style.display = 'none';
      allWraps[j].innerHTML = '';
    }
    for (var j = 0; j < allBtns.length; j++) {
      allBtns[j].textContent = '回复';
    }

    wrap.innerHTML =
      '<div style="background:#f9f9f9;padding:0.8rem;border:2px solid #000;">' +
        '<div style="display:flex;gap:1rem;margin-bottom:0.5rem;flex-wrap:wrap;">' +
          '<input name="author" placeholder="昵称 *" required style="padding:0.4rem;width:180px;border:2px solid #000;" />' +
          '<input type="email" name="email" placeholder="邮箱（选填）" style="padding:0.4rem;width:220px;border:2px solid #000;" />' +
        '</div>' +
        '<textarea name="content" placeholder="回复点什么..." required style="padding:0.4rem;width:100%;min-height:60px;margin-bottom:0.3rem;border:2px solid #000;"></textarea>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">' +
          '<div class="quick-emoji-wrap"></div>' +
          '<div style="display:flex;gap:0.5rem;">' +
            '<button type="button" class="cancel-reply" style="padding:0.4rem 0.8rem;background:#fff;color:#000;border:2px solid #000;font-weight:700;cursor:pointer;">取消</button>' +
            '<button type="button" class="submit-reply" style="padding:0.4rem 0.8rem;background:#000;color:#fff;border:2px solid #000;font-weight:700;cursor:pointer;">提交回复</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    wrap.style.display = 'block';
    btn.textContent = '收起回复';

    var rta = wrap.querySelector('textarea[name="content"]');
    var rbtn = wrap.querySelector('.submit-reply');
    var cbtn = wrap.querySelector('.cancel-reply');
    var emojiWrap = wrap.querySelector('.quick-emoji-wrap');
    emojiWrap.appendChild(makeQuickEmojis(rta));

    cbtn.addEventListener('click', function() {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
      btn.textContent = '回复';
    });

    rbtn.addEventListener('click', function() {
      var author = wrap.querySelector('input[name="author"]').value.trim();
      var email = wrap.querySelector('input[name="email"]').value.trim();
      var content = rta.value.trim();
      if (!author || !content) {
        alert('请填写昵称和内容');
        return;
      }
      rbtn.disabled = true;
      rbtn.textContent = '提交中...';
      fetch('/api/comments?path=' + encodeURIComponent(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: author, email: email, content: content, parent_id: parseInt(parentId) })
      })
      .then(function(r) {
        if (!r.ok) return r.json().then(function(err) { throw new Error(err.error || '提交失败'); });
        return r.json();
      })
      .then(function() {
        load();
      })
      .catch(function(err) {
        alert('提交失败: ' + err.message);
        rbtn.disabled = false;
        rbtn.textContent = '提交回复';
      });
    });
  }

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
        var tree = buildTree(d);
        var h = '';
        for (var i = 0; i < tree.length; i++) {
          h += renderItem(tree[i], 0);
        }
        cl.innerHTML = h;
        bindReplyButtons();
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
      if (!r.ok) return r.json().then(function(err) { throw new Error(err.error || '提交失败'); });
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
