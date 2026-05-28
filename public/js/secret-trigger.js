(function() {
  var keys = [];
  var konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  var footerClicks = 0;
  var triggered = false;

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

  // Konami Code 监听
  document.addEventListener('keydown', function(e) {
    keys.push(e.key);
    if (keys.length > 10) keys.shift();
    if (keys.join(',') === konami.join(',')) showSecret();
  });

  // 点击页脚5次触发
  var footer = document.querySelector('footer');
  if (footer) {
    footer.addEventListener('click', function() {
      footerClicks++;
      if (footerClicks >= 5) showSecret();
    });
  }
})();