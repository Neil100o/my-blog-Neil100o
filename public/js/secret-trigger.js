(function() {
  var keys = [];
  var konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  var triggered = false;

  // 顺序点击触发器
  var clickSequence = [];
  var targetSequence = ['footer', 'header-title', 'admin-link'];
  var sequenceTimeout = null;
  var SEQUENCE_RESET_MS = 5000; // 5秒内完成序列

  function showSecret() {
    if (triggered) return;
    triggered = true;
    
    var div = document.createElement('div');
    div.innerHTML = '🚪 发现秘密空间';
    div.style.cssText = 'position:fixed;bottom:2rem;right:2rem;background:#000;color:#fff;padding:1rem 1.5rem;border:2px solid #cc0000;cursor:pointer;font-weight:800;font-size:0.9rem;letter-spacing:0.05em;text-transform:uppercase;z-index:9999;transition:all 0.3s;';
    div.onmouseenter = function() { div.style.background = '#cc0000'; };
    div.onmouseleave = function() { div.style.background = '#000'; };
    div.onclick = function() { location.href = '/secret/'; };
    document.body.appendChild(div);
  }

  function resetSequence() {
    clickSequence = [];
    if (sequenceTimeout) {
      clearTimeout(sequenceTimeout);
      sequenceTimeout = null;
    }
  }

  function checkSequence(step) {
    // 如果序列已经开始但超时了，重置
    if (sequenceTimeout) {
      clearTimeout(sequenceTimeout);
    }
    
    clickSequence.push(step);
    
    // 检查当前序列是否匹配目标序列的前缀
    var isValid = true;
    for (var i = 0; i < clickSequence.length; i++) {
      if (clickSequence[i] !== targetSequence[i]) {
        isValid = false;
        break;
      }
    }
    
    if (!isValid) {
      // 顺序错了，重置
      resetSequence();
      return;
    }
    
    // 检查是否完成整个序列
    if (clickSequence.length === targetSequence.length) {
      showSecret();
      resetSequence();
      return;
    }
    
    // 设置超时，5秒内没完成就重置
    sequenceTimeout = setTimeout(function() {
      clickSequence = [];
      sequenceTimeout = null;
    }, SEQUENCE_RESET_MS);
  }

  // Konami Code 监听
  document.addEventListener('keydown', function(e) {
    keys.push(e.key);
    if (keys.length > 10) keys.shift();
    if (keys.join(',') === konami.join(',')) showSecret();
  });

  // 顺序点击触发：footer → header标题 → admin链接
  // 1. 页脚
  var footer = document.querySelector('footer');
  if (footer) {
    footer.addEventListener('click', function(e) {
      e.stopPropagation();
      checkSequence('footer');
    });
  }

  // 2. Header 标题（h2 里的 a）
  var headerTitle = document.querySelector('header h2 a');
  if (headerTitle) {
    headerTitle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      checkSequence('header-title');
      // 不跳转，只是作为触发步骤
    });
  }

  // 3. Admin 链接
  var adminLink = document.querySelector('a.admin-link');
  if (adminLink) {
    adminLink.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      checkSequence('admin-link');
      // 不跳转，只是作为触发步骤
    });
  }
})();
