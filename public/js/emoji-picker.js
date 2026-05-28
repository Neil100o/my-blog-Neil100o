(function() {
  var emojis = ['😀','😂','🤣','😭','😍','🥰','😘','😡','🥶','🤡','👍','👎','🙏','💪','🎉','🔥','💀','☕','🍺','🍜','🌹','🌟','✨','❤️','💔','♻️','🇨🇳','☭'];
  var kaomojis = ['(⌒▽⌒)☆','(≧▽≦)','(￣▽￣)','(｡･ω･｡)','(´･ω･`)','(｀・ω・´)','(✿◡‿◡)','(╯°□°）╯︵ ┻━┻','(╥﹏╥)','(；´Д｀)','(￣ヘ￣)','( ﾟдﾟ)','(・ω<< )★','(´-ι_-｀)','(｡ŏ_ŏ)','(ง •_•)ง','( ͡° ͜ʖ ͡°)','(☭ ͜ʖ ☭)','(✿ ♡‿♡)','(>ω<<)','(´；ω；`)','(╬ Ò﹏Ó)','(ﾉ*>∀<<)ﾉ♡','(￣﹃￣)','( つ•̀ω•́)つ','(๑•̀ㅂ•́)و✧','(°ー°〃)','( ´_ゝ`)'];

  var container = document.getElementById('emoji-container');
  var textarea = document.getElementById('comment-textarea');
  if (!container || !textarea) return;

  function makeSection(title, items) {
    var div = document.createElement('div');
    div.style.marginBottom = '0.6rem';
    var small = document.createElement('small');
    small.style.color = '#666';
    small.style.fontWeight = 'bold';
    small.textContent = title;
    div.appendChild(small);
    var wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexWrap = 'wrap';
    wrap.style.gap = '0.3rem';
    wrap.style.marginTop = '0.3rem';
    for (var i = 0; i < items.length; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emoji-btn';
      btn.style.padding = '0.2rem 0.4rem';
      btn.style.background = 'white';
      btn.style.border = '1px solid #e0e0e0';
      btn.style.borderRadius = '4px';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = title === 'Emoji' ? '1.2rem' : '0.85rem';
      btn.style.whiteSpace = 'nowrap';
      btn.textContent = items[i];
      wrap.appendChild(btn);
    }
    div.appendChild(wrap);
    return div;
  }

  container.appendChild(makeSection('Emoji', emojis));
  container.appendChild(makeSection('颜文字', kaomojis));

  document.getElementById('emoji-toggle').addEventListener('click', function() {
    var panel = document.getElementById('emoji-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('emoji-panel').addEventListener('click', function(e) {
    if (e.target.classList.contains('emoji-btn')) {
      var char = e.target.textContent;
      var start = textarea.selectionStart;
      var end = textarea.selectionEnd;
      var text = textarea.value;
      textarea.value = text.slice(0, start) + char + text.slice(end);
      textarea.focus();
      textarea.setSelectionRange(start + char.length, start + char.length);
    }
  });
})();