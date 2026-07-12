(function() {
  // ==================== 配置 ====================
  // 小宠物外观 - 使用视频
  var PET_VIDEO_SRC = '/pet.webm';
  var PET_SIZE = 80; // 视频尺寸可以比 emoji 大点
  
  // 移动速度配置
  var SPEED_MIN = 0.3;
  var SPEED_MAX = 1.2;
  var EDGE_MARGIN = 20;
  // 小宠物外观
  var PET_EMOJI = '🐱';
  var PET_SIZE = 36;
  
  // 移动速度配置
  var SPEED_MIN = 0.3;
  var SPEED_MAX = 1.2;
  var EDGE_MARGIN = 20; // 离边缘距离
  
  // 状态
  var x = 0, y = 0;
  var vx = 0, vy = 0;
  var isMoving = true;
  var modalOpen = false;
  
  // 初始化位置（随机在页面边缘）
  function initPosition() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var edge = Math.floor(Math.random() * 4); // 0=上,1=右,2=下,3=左
    
    switch (edge) {
      case 0: x = Math.random() * w; y = EDGE_MARGIN; break;
      case 1: x = w - PET_SIZE - EDGE_MARGIN; y = Math.random() * h; break;
      case 2: x = Math.random() * w; y = h - PET_SIZE - EDGE_MARGIN; break;
      case 3: x = EDGE_MARGIN; y = Math.random() * h; break;
    }
  }
  
  // 创建小宠物 - 用 video 标签
  var pet = document.createElement('video');
  pet.src = PET_VIDEO_SRC;
  pet.autoplay = true;
  pet.loop = true;
  pet.muted = true;
  pet.playsInline = true;
  pet.style.cssText = 'position:fixed;width:' + PET_SIZE + 'px;height:' + PET_SIZE + 'px;cursor:pointer;z-index:9998;user-select:none;transition:transform 0.2s;opacity:0.8;object-fit:contain;pointer-events:auto;';
  document.body.appendChild(pet);
  
  initPosition();
  
  // 随机速度
  function randomSpeed() {
    var speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
    var angle = Math.random() * Math.PI * 2;
    return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  }
  
  var speed = randomSpeed();
  vx = speed.x;
  vy = speed.y;
  
  // 移动动画
  function move() {
    if (!isMoving || modalOpen) {
      requestAnimationFrame(move);
      return;
    }
    
    x += vx;
    y += vy;
    
    var w = window.innerWidth;
    var h = window.innerHeight;
    
    // 边界反弹
    if (x <= EDGE_MARGIN) { x = EDGE_MARGIN; vx = Math.abs(vx); }
    if (x >= w - PET_SIZE - EDGE_MARGIN) { x = w - PET_SIZE - EDGE_MARGIN; vx = -Math.abs(vx); }
    if (y <= EDGE_MARGIN) { y = EDGE_MARGIN; vy = Math.abs(vy); }
    if (y >= h - PET_SIZE - EDGE_MARGIN) { y = h - PET_SIZE - EDGE_MARGIN; vy = -Math.abs(vy); }
    
    // 偶尔随机变向
    if (Math.random() < 0.005) {
      var s = randomSpeed();
      vx = s.x;
      vy = s.y;
    }
    
    pet.style.left = x + 'px';
    pet.style.top = y + 'px';
    pet.style.transform = vx > 0 ? 'scaleX(1)' : 'scaleX(-1)'; // 朝向移动方向
    
    requestAnimationFrame(move);
  }
  
  requestAnimationFrame(move);
  
  // Hover 效果
  pet.onmouseenter = function() {
    pet.style.transform = 'scale(1.2)';
    pet.style.opacity = '1';
  };
  pet.onmouseleave = function() {
    if (!modalOpen) {
      pet.style.transform = vx > 0 ? 'scaleX(1)' : 'scaleX(-1)';
      pet.style.opacity = '0.8';
    }
  };
  
  // 点击弹出输入框
  pet.addEventListener('click', function(e) {
    e.stopPropagation();
    if (modalOpen) return;
    modalOpen = true;
    isMoving = false;
    
    // 创建遮罩
    var overlay = document.createElement('div');
    overlay.id = 'pet-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;';
    
    // 输入框
    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border:3px solid #000;padding:2rem;max-width:380px;width:90%;box-shadow:8px 8px 0 #000;';
    box.innerHTML = '<h3 style="margin:0 0 1rem 0;border-bottom:3px solid #cc0000;padding-bottom:0.5rem;font-size:1.3rem;">🔐 入口</h3>' +
      '<p style="color:#666;margin-bottom:1.2rem;font-size:0.9rem;line-height:1.6;">如果你有秘钥，可以进入秘密空间。</p>' +
      '<input type="password" id="pet-pwd" placeholder="输入秘钥" style="width:100%;padding:0.8rem;border:2px solid #000;font-size:1rem;margin-bottom:1rem;box-sizing:border-box;" />' +
      '<button id="pet-submit" style="width:100%;padding:0.9rem;background:#000;color:#fff;border:2px solid #000;font-weight:800;cursor:pointer;font-size:1rem;">进入</button>' +
      '<button id="pet-close" style="width:100%;padding:0.7rem;background:#fff;color:#000;border:2px solid #000;font-weight:700;cursor:pointer;margin-top:0.5rem;font-size:0.9rem;">关闭</button>';
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    var pwdInput = document.getElementById('pet-pwd');
    var submitBtn = document.getElementById('pet-submit');
    var closeBtn = document.getElementById('pet-close');
    
    // 提交
    submitBtn.addEventListener('click', function() {
      var pwd = pwdInput.value.trim();
      if (!pwd) { pwdInput.focus(); return; }
      
      submitBtn.disabled = true;
      submitBtn.textContent = '验证中...';
      
      fetch('/api/secret-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.key) {
          sessionStorage.setItem('sk_', data.key);
          localStorage.setItem('sk_', data.key);
          location.href = '/collection/';
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = '进入';
          pwdInput.value = '';
          pwdInput.placeholder = '秘钥错误，请重试';
          pwdInput.style.borderColor = '#cc0000';
          setTimeout(function() { pwdInput.style.borderColor = '#000'; }, 2000);
        }
      })
      .catch(function() {
        submitBtn.disabled = false;
        submitBtn.textContent = '进入';
        alert('验证失败，请重试');
      });
    });
    
    // 关闭
    closeBtn.addEventListener('click', function() {
      overlay.remove();
      modalOpen = false;
      isMoving = true;
      var s = randomSpeed();
      vx = s.x;
      vy = s.y;
      requestAnimationFrame(move);
    });
    
    // Enter 键
    pwdInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submitBtn.click();
    });
    
    pwdInput.focus();
  });
})();
