(function() {
  // ==================== 配置 ====================
  var PET_WIDTH = 200;
  var PET_HEIGHT = 200;
  var SPEED_MIN = 0.12;
  var SPEED_MAX = 0.35;
  var EDGE_MARGIN = 40;
  
  // 状态
  var x = 0, y = 0;
  var vx = 0, vy = 0;
  var isMoving = true;
  var modalOpen = false;
  var spineLoaded = false;
  var doll = null;
  var app = null;
  
  // 初始化位置（随机在页面边缘）
  function initPosition() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: x = Math.random() * (w - PET_WIDTH); y = EDGE_MARGIN; break;
      case 1: x = w - PET_WIDTH - EDGE_MARGIN; y = Math.random() * (h - PET_HEIGHT); break;
      case 2: x = Math.random() * (w - PET_WIDTH); y = h - PET_HEIGHT - EDGE_MARGIN; break;
      case 3: x = EDGE_MARGIN; y = Math.random() * (h - PET_HEIGHT); break;
    }
  }
  
  // 创建小宠物容器
  var wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;width:' + PET_WIDTH + 'px;height:' + PET_HEIGHT + 'px;z-index:9998;pointer-events:none;overflow:hidden;';
  document.body.appendChild(wrapper);
  
  initPosition();
  wrapper.style.left = x + 'px';
  wrapper.style.top = y + 'px';
  
  // 加载脚本
  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  // 加载二进制文件
  function loadBinary(url) {
    return fetch(url).then(function(r) { return r.arrayBuffer(); });
  }
  
  // 加载文本文件
  function loadText(url) {
    return fetch(url).then(function(r) { return r.text(); });
  }
  
  // 加载图片
  function loadImage(url) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() { resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }
  
  // 初始化 PixiJS + Spine 2.1
  function initPixiSpine() {
    // 创建 PixiJS Application（透明背景）
    app = new PIXI.Application(PET_WIDTH, PET_HEIGHT, {
      transparent: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      resolution: window.devicePixelRatio || 1,
      autoResize: true
    });
    
    var canvas = app.view;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    wrapper.appendChild(canvas);
    
    // 并行加载所有资源
    Promise.all([
      loadBinary('/ak74m.skel'),
      loadText('/ak74m.atlas'),
      loadImage('/ak74m.png')
    ]).then(function(results) {
      var skelBuffer = results[0];
      var atlasText = results[1];
      var pngImage = results[2];
      
      // 1. 将二进制 .skel 转为 JSON
      var skelBinary = new SkeletonBinary();
      skelBinary.data = new Uint8Array(skelBuffer);
      skelBinary.initJson();
      var spineJson = skelBinary.json;
      
      // 2. 创建 Atlas - 修复大小写不匹配问题
      var spineAtlas = new PIXI.spine.SpineRuntime.Atlas(
        atlasText,
        function(line, callback) {
          // atlas 中引用的是 "AK74M.png"，但我们加载的是 "ak74m.png"
          // 忽略 line 参数，直接返回已加载的纹理
          callback(new PIXI.BaseTexture(pngImage));
        },
        function(atlas) {
          // atlas 加载完成
          console.log('Atlas 加载完成');
        }
      );
      
      // 3. 解析 Skeleton Data
      var attachmentParser = new PIXI.spine.SpineRuntime.AtlasAttachmentParser(spineAtlas);
      var skeletonJsonParser = new PIXI.spine.SpineRuntime.SkeletonJsonParser(attachmentParser);
      var skeletonData = skeletonJsonParser.readSkeletonData(spineJson, "Doll");
      
      // 4. 创建 Spine 实例
      doll = new PIXI.spine.Spine(skeletonData);
      
      // 5. 设置位置和缩放（居中）
      doll.position.set(PET_WIDTH / 2, PET_HEIGHT * 0.75);
      
      // 计算缩放使角色适应容器
      var skeletonWidth = skeletonData.width || 100;
      var skeletonHeight = skeletonData.height || 100;
      var scaleX = (PET_WIDTH * 0.6) / skeletonWidth;
      var scaleY = (PET_HEIGHT * 0.6) / skeletonHeight;
      var scale = Math.min(scaleX, scaleY, 0.7);
      doll.scale.set(scale);
      
      // 6. 添加到舞台
      app.stage.addChild(doll);
      
      // 7. 启用自动更新
      PIXI.spine.Spine.globalAutoUpdate = true;
      doll.autoUpdate = true;
      
      // 8. 播放行走动画（循环）
      doll.state.setAnimationByName(0, "move", true);
      
      spineLoaded = true;
      console.log('Spine 2.1 加载成功');
      
    }).catch(function(err) {
      console.error('Spine 加载失败:', err);
      showFallback();
    });
  }
  
  // 回退：显示静态图
  function showFallback() {
    wrapper.innerHTML = '';
    var img = document.createElement('img');
    img.src = '/ak74m.png';
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;';
    wrapper.appendChild(img);
  }
  
  // 按顺序加载依赖，然后初始化
  loadScript('/spine-lib/js/pixi.js')
    .then(function() {
      // 确保 PIXI 完全初始化
      if (typeof PIXI === 'undefined' || !PIXI.BLEND_MODES) {
        return new Promise(function(resolve) {
          var check = setInterval(function() {
            if (typeof PIXI !== 'undefined' && PIXI.BLEND_MODES) {
              clearInterval(check);
              resolve();
            }
          }, 50);
        });
      }
    })
    .then(function() { return loadScript('/spine-lib/js/pixi-spine-sjzs.js'); })
    .then(function() { return loadScript('/spine-lib/js/skb.js'); })
    .then(function() { initPixiSpine(); })
    .catch(function(err) {
      console.error('依赖加载失败:', err);
      showFallback();
    });
  
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
    if (x >= w - PET_WIDTH - EDGE_MARGIN) { x = w - PET_WIDTH - EDGE_MARGIN; vx = -Math.abs(vx); }
    if (y <= EDGE_MARGIN) { y = EDGE_MARGIN; vy = Math.abs(vy); }
    if (y >= h - PET_HEIGHT - EDGE_MARGIN) { y = h - PET_HEIGHT - EDGE_MARGIN; vy = -Math.abs(vy); }
    
    // 偶尔随机变向
    if (Math.random() < 0.002) {
      var s = randomSpeed();
      vx = s.x;
      vy = s.y;
    }
    
    wrapper.style.left = x + 'px';
    wrapper.style.top = y + 'px';
    
    // 水平翻转（Spine 方式）
    if (doll && spineLoaded) {
      doll.skeleton.flipX = vx < 0;
    } else {
      // 回退：CSS 翻转
      var content = wrapper.firstElementChild;
      if (content && content.tagName !== 'CANVAS') {
        content.style.transform = vx > 0 ? 'scaleX(1)' : 'scaleX(-1)';
      }
    }
    
    requestAnimationFrame(move);
  }
  
  requestAnimationFrame(move);
  
  // 点击区域（覆盖整个 wrapper）
  var hitArea = document.createElement('div');
  hitArea.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;cursor:pointer;z-index:1;pointer-events:auto;';
  wrapper.appendChild(hitArea);
  
  // Hover 效果
  hitArea.onmouseenter = function() {
    if (doll && spineLoaded) {
      // Spine 缩放通过 scale 实现
      var baseScale = doll.scale.x;
      doll.scale.set(baseScale * 1.1);
    } else {
      var content = wrapper.firstElementChild;
      if (content) {
        content.style.transform = (vx > 0 ? 'scaleX(1)' : 'scaleX(-1)') + ' scale(1.1)';
      }
    }
    wrapper.style.opacity = '1';
  };
  hitArea.onmouseleave = function() {
    if (!modalOpen) {
      if (doll && spineLoaded) {
        var baseScale = doll.scale.x / 1.1;
        doll.scale.set(baseScale);
      } else {
        var content = wrapper.firstElementChild;
        if (content) {
          content.style.transform = vx > 0 ? 'scaleX(1)' : 'scaleX(-1)';
        }
      }
      wrapper.style.opacity = '0.9';
    }
  };
  
  // 点击弹出输入框
  hitArea.addEventListener('click', function(e) {
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
    box.style.cssText = 'background:#fff;border:3px solid #000;padding:2rem;max-width:400px;width:90%;box-shadow:8px 8px 0 #000;';
    box.innerHTML = '<h3 style="margin:0 0 1rem 0;border-bottom:3px solid #cc0000;padding-bottom:0.5rem;font-size:1.3rem;">🔐 入口</h3>' +
      '<p style="color:#666;margin-bottom:1.2rem;font-size:0.9rem;line-height:1.6;">如果你有秘钥，可以进入秘密空间。</p>' +
      '<div style="position:relative;margin-bottom:1rem;">' +
        '<input type="password" id="pet-pwd" placeholder="输入秘钥" style="width:100%;padding:0.8rem;border:2px solid #000;font-size:1rem;box-sizing:border-box;padding-right:3rem;" />' +
        '<button id="pet-toggle" type="button" style="position:absolute;right:0.5rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.2rem;padding:0.2rem;">👁</button>' +
      '</div>' +
      '<button id="pet-submit" style="width:100%;padding:0.9rem;background:#000;color:#fff;border:2px solid #000;font-weight:800;cursor:pointer;font-size:1rem;">进入</button>' +
      '<button id="pet-close" style="width:100%;padding:0.7rem;background:#fff;color:#000;border:2px solid #000;font-weight:700;cursor:pointer;margin-top:0.5rem;font-size:0.9rem;">关闭</button>';
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    var pwdInput = document.getElementById('pet-pwd');
    var toggleBtn = document.getElementById('pet-toggle');
    var submitBtn = document.getElementById('pet-submit');
    var closeBtn = document.getElementById('pet-close');
    
    // 显示/隐藏密码
    toggleBtn.addEventListener('click', function() {
      var isPassword = pwdInput.type === 'password';
      pwdInput.type = isPassword ? 'text' : 'password';
      toggleBtn.textContent = isPassword ? '🙈' : '👁';
    });
    
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
          location.href = '/whispers/';
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
