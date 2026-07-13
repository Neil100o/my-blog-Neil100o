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
  var dollBaseScale = 1;
  var app = null;
  var currentAnim = 'move'; // 当前动画状态
  var stopTimer = null;     // 停止定时器
  var moveTimer = null;     // 移动定时器
  var interactionTimer = null;
  var clickResetTimer = null;
  var hintTimer = null;
  var petClickCount = 0;
  var pageDialogue = [];
  var pageDialogueIndex = 0;
  var travelTarget = null;

  // 指定页面可以通过 meta 配置独有的小人台词。
  var dialogueMeta = document.querySelector('meta[name="pet-dialogue"]');
  if (dialogueMeta) {
    try {
      var parsedDialogue = JSON.parse(dialogueMeta.getAttribute('content') || '[]');
      if (Array.isArray(parsedDialogue)) {
        pageDialogue = parsedDialogue.filter(function(line) {
          return typeof line === 'string' && line.trim();
        });
      }
    } catch (err) {
      console.warn('页面小人台词配置无效:', err);
    }
  }
  
  // 动画切换
  function setAnimation(name, loop, forceRestart) {
    if (!doll || !spineLoaded || (!forceRestart && currentAnim === name)) return;
    currentAnim = name;
    doll.state.setAnimationByName(0, name, loop !== false);
  }
  
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
  
  // 创建加载动画
  var loader = document.createElement('div');
  loader.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:40px;height:40px;pointer-events:none;';
  loader.innerHTML = '<div style="width:100%;height:100%;border:3px solid #eee;border-top-color:#cc0000;border-radius:50%;animation:pet-spin 0.8s linear infinite;"></div>';
  wrapper.appendChild(loader);
  
  // 添加旋转动画样式
  var style = document.createElement('style');
  style.textContent = '@keyframes pet-spin { to { transform: rotate(360deg); } }' +
    '[data-pet-note]{cursor:pointer;text-decoration-line:underline;text-decoration-style:dashed;text-decoration-color:#cc0000;text-underline-offset:0.18em;transition:color 160ms ease,text-decoration-color 160ms ease;}' +
    '[data-pet-note]:hover,[data-pet-note]:focus-visible{color:#cc0000;text-decoration-color:#000;}' +
    'button[data-pet-note]{font:inherit;color:inherit;background:none;border:0;padding:0;}' +
    'button[data-pet-note]:focus-visible{outline:2px solid #cc0000;outline-offset:3px;}';
  document.head.appendChild(style);
  
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
      dollBaseScale = scale;
      doll.scale.set(scale);
      
      // 6. 添加到舞台
      app.stage.addChild(doll);
      
      // 7. 启用自动更新
      PIXI.spine.Spine.globalAutoUpdate = true;
      doll.autoUpdate = true;
      
      // 8. 播放行走动画（循环）
      doll.state.setAnimationByName(0, "move", true);
      currentAnim = 'move';
      
      // 隐藏加载动画
      if (loader) {
        loader.style.display = 'none';
      }
      
      // 启动状态切换循环
      scheduleNextStop();
      
      spineLoaded = true;
      console.log('Spine 2.1 加载成功');
      
    }).catch(function(err) {
      console.error('Spine 加载失败:', err);
      showFallback();
    });
  }
  
  // 回退：显示静态图
  function showFallback() {
    if (loader) loader.style.display = 'none';
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
  
  // 安排下一次停止
  function scheduleNextStop() {
    if (stopTimer) clearTimeout(stopTimer);
    if (moveTimer) clearTimeout(moveTimer);
    
    // 2-6秒后随机停止
    var moveDuration = 2000 + Math.random() * 4000;
    stopTimer = setTimeout(function() {
      if (modalOpen) { scheduleNextStop(); return; }
      
      // 停止移动，切换到 wait 动画
      isMoving = false;
      var idleAnimation = Math.random() < 0.32 ? 'lying' : 'wait';
      setAnimation(idleAnimation, true, true);
      
      // 躺下时多休息一会，普通等待则短暂停留
      var stopDuration = idleAnimation === 'lying'
        ? 2800 + Math.random() * 2400
        : 1000 + Math.random() * 2000;
      moveTimer = setTimeout(function() {
        if (modalOpen) { scheduleNextStop(); return; }
        
        // 恢复移动，切换到 move 动画
        var s = randomSpeed();
        vx = s.x;
        vy = s.y;
        isMoving = true;
        setAnimation('move', true, true);
        
        scheduleNextStop();
      }, stopDuration);
    }, moveDuration);
  }
  
  var speed = randomSpeed();
  vx = speed.x;
  vy = speed.y;
  
  // 移动动画
  function move() {
    if ((!isMoving && !travelTarget) || modalOpen) {
      requestAnimationFrame(move);
      return;
    }

    var w = window.innerWidth;
    var h = window.innerHeight;
    var arrivedNote = null;

    if (travelTarget) {
      var dx = travelTarget.x - x;
      var dy = travelTarget.y - y;
      var distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= travelTarget.speed) {
        x = travelTarget.x;
        y = travelTarget.y;
        arrivedNote = travelTarget;
        travelTarget = null;
        isMoving = false;
      } else {
        vx = dx / distance * travelTarget.speed;
        vy = dy / distance * travelTarget.speed;
        x += vx;
        y += vy;
      }
    } else {
      x += vx;
      y += vy;

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

    if (arrivedNote) {
      setAnimation('wait', true, true);
      showPetHint(arrivedNote.text, arrivedNote.duration);
      resumeRoaming(arrivedNote.duration - 150);
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
      doll.scale.set(dollBaseScale * 1.1);
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
        doll.scale.set(dollBaseScale);
      } else {
        var content = wrapper.firstElementChild;
        if (content) {
          content.style.transform = vx > 0 ? 'scaleX(1)' : 'scaleX(-1)';
        }
      }
      wrapper.style.opacity = '0.9';
    }
  };

  // 小型文字反馈，提示连续点击进度
  var petHint = document.createElement('div');
  petHint.style.cssText = 'position:absolute;left:50%;top:5px;transform:translateX(-50%) translateY(4px);z-index:2;padding:0.3rem 0.55rem;background:#fff;border:1px solid #000;color:#000;font-size:0.72rem;font-weight:700;letter-spacing:0.04em;width:max-content;max-width:180px;box-sizing:border-box;white-space:normal;text-align:center;line-height:1.45;opacity:0;transition:opacity 160ms ease,transform 160ms ease;pointer-events:none;';
  petHint.setAttribute('role', 'status');
  petHint.setAttribute('aria-live', 'polite');
  wrapper.appendChild(petHint);

  function showPetHint(text, duration) {
    petHint.textContent = text;
    petHint.style.opacity = '1';
    petHint.style.transform = 'translateX(-50%) translateY(0)';
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function() {
      petHint.style.opacity = '0';
      petHint.style.transform = 'translateX(-50%) translateY(4px)';
    }, duration || 1100);
  }

  function pauseRoaming() {
    isMoving = false;
    travelTarget = null;
    if (stopTimer) clearTimeout(stopTimer);
    if (moveTimer) clearTimeout(moveTimer);
    if (interactionTimer) clearTimeout(interactionTimer);
    if (doll && spineLoaded) doll.scale.set(dollBaseScale);
  }

  function resumeRoaming(delay) {
    if (interactionTimer) clearTimeout(interactionTimer);
    interactionTimer = setTimeout(function() {
      if (modalOpen) return;
      var nextSpeed = randomSpeed();
      vx = nextSpeed.x;
      vy = nextSpeed.y;
      isMoving = true;
      setAnimation('move', true, true);
      scheduleNextStop();
    }, delay || 0);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // 点击带 data-pet-note 的文字后，让小人走到文字附近再说话。
  function summonPetToNote(trigger) {
    if (modalOpen) return;

    var noteText = (trigger.getAttribute('data-pet-note') || '').trim();
    if (!noteText) return;

    var rect = trigger.getBoundingClientRect();
    var targetX = rect.left + rect.width / 2 - PET_WIDTH / 2;
    var targetY = rect.top - PET_HEIGHT * 0.7;
    if (targetY < 8) targetY = rect.bottom - PET_HEIGHT * 0.65;
    targetX = clamp(targetX, 8, Math.max(8, window.innerWidth - PET_WIDTH - 8));
    targetY = clamp(targetY, 8, Math.max(8, window.innerHeight - PET_HEIGHT - 8));

    pauseRoaming();
    petClickCount = 0;
    if (clickResetTimer) clearTimeout(clickResetTimer);
    if (hintTimer) clearTimeout(hintTimer);
    petHint.style.opacity = '0';

    var dx = targetX - x;
    var dy = targetY - y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    travelTarget = {
      x: targetX,
      y: targetY,
      text: noteText,
      duration: Math.min(9000, Math.max(5200, 1200 + noteText.length * 135)),
      speed: Math.min(5.5, Math.max(1.8, distance / 120))
    };
    isMoving = true;
    setAnimation('move', true, true);
  }

  var noteTriggers = document.querySelectorAll('[data-pet-note]');
  for (var noteIndex = 0; noteIndex < noteTriggers.length; noteIndex += 1) {
    noteTriggers[noteIndex].addEventListener('click', function(e) {
      e.stopPropagation();
      summonPetToNote(e.currentTarget);
    });
  }
  
  // 连续点击三次后，从小人位置放出秘密入口
  hitArea.addEventListener('click', function(e) {
    e.stopPropagation();
    if (modalOpen) return;

    // 有页面专属台词时先逐句播放；全部说完后恢复原来的三击入口。
    if (pageDialogueIndex < pageDialogue.length) {
      var dialogueLine = pageDialogue[pageDialogueIndex];
      pageDialogueIndex += 1;
      var dialogueDuration = Math.min(5200, Math.max(2200, 900 + dialogueLine.length * 120));
      pauseRoaming();
      setAnimation('wait', true, true);
      showPetHint(dialogueLine, dialogueDuration);
      resumeRoaming(dialogueDuration - 150);
      return;
    }

    petClickCount += 1;
    if (clickResetTimer) clearTimeout(clickResetTimer);
    clickResetTimer = setTimeout(function() {
      petClickCount = 0;
    }, 4500);

    pauseRoaming();

    if (petClickCount === 1) {
      setAnimation('wait', true, true);
      showPetHint('嗯？');
      resumeRoaming(900);
      return;
    }

    if (petClickCount === 2) {
      setAnimation('wait', true, true);
      showPetHint('再点一次');
      resumeRoaming(1350);
      return;
    }

    petClickCount = 0;
    if (clickResetTimer) clearTimeout(clickResetTimer);
    modalOpen = true;
    setAnimation('wait', true, true);
    showPetHint('入口已找到');

    var petRect = wrapper.getBoundingClientRect();
    var originX = petRect.left + petRect.width / 2;
    var originY = petRect.top + petRect.height / 2;
    
    // 创建遮罩
    var overlay = document.createElement('div');
    overlay.id = 'pet-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0);z-index:9999;transition:background 480ms ease;';
    
    // 输入框
    var box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', '秘密入口');
    box.style.cssText = 'position:fixed;left:' + originX + 'px;top:' + originY + 'px;transform:translate(-50%,-50%) scale(0.16);opacity:0;background:#fff;border:3px solid #000;padding:2rem;max-width:400px;width:calc(100% - 2rem);box-sizing:border-box;box-shadow:8px 8px 0 #000;transition:left 560ms cubic-bezier(.22,.8,.24,1),top 560ms cubic-bezier(.22,.8,.24,1),transform 560ms cubic-bezier(.22,.8,.24,1),opacity 260ms ease;';
    box.innerHTML = '<h3 style="margin:0 0 1rem 0;border-bottom:3px solid #cc0000;padding-bottom:0.5rem;font-size:1.3rem;letter-spacing:0.08em;">秘密入口</h3>' +
      '<p style="color:#666;margin-bottom:1.2rem;font-size:0.9rem;line-height:1.6;">如果你有秘钥，可以进入秘密空间。</p>' +
      '<div style="position:relative;margin-bottom:1rem;">' +
        '<input type="password" id="pet-pwd" placeholder="输入秘钥" style="width:100%;padding:0.8rem;border:2px solid #000;font-size:1rem;box-sizing:border-box;padding-right:4.5rem;" />' +
        '<button id="pet-toggle" type="button" aria-label="显示秘钥" style="position:absolute;right:0.45rem;top:50%;transform:translateY(-50%);background:#fff;border:1px solid #000;cursor:pointer;font-size:0.75rem;font-weight:700;padding:0.3rem 0.5rem;line-height:1;min-width:3rem;">显示</button>' +
      '</div>' +
      '<button id="pet-submit" style="width:100%;padding:0.9rem;background:#000;color:#fff;border:2px solid #000;font-weight:800;cursor:pointer;font-size:1rem;">进入</button>' +
      '<button id="pet-close" style="width:100%;padding:0.7rem;background:#fff;color:#000;border:2px solid #000;font-weight:700;cursor:pointer;margin-top:0.5rem;font-size:0.9rem;">关闭</button>';
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        overlay.style.background = 'rgba(255,255,255,0.9)';
        box.style.left = '50%';
        box.style.top = '50%';
        box.style.transform = 'translate(-50%,-50%) scale(1)';
        box.style.opacity = '1';
      });
    });
    
    var pwdInput = document.getElementById('pet-pwd');
    var toggleBtn = document.getElementById('pet-toggle');
    var submitBtn = document.getElementById('pet-submit');
    var closeBtn = document.getElementById('pet-close');
    
    // 显示/隐藏密码
    toggleBtn.addEventListener('click', function() {
      var isPassword = pwdInput.type === 'password';
      pwdInput.type = isPassword ? 'text' : 'password';
      toggleBtn.textContent = isPassword ? '隐藏' : '显示';
      toggleBtn.setAttribute('aria-label', isPassword ? '隐藏秘钥' : '显示秘钥');
    });
    
    // 提交
    submitBtn.addEventListener('click', function() {
      var pwd = pwdInput.value.trim();
      if (!pwd) { pwdInput.focus(); return; }
      
      submitBtn.disabled = true;
      submitBtn.textContent = '验证中...';
      
      fetch('/api/secret-unlock', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          sessionStorage.removeItem('sk_');
          localStorage.removeItem('sk_');
          sessionStorage.setItem('whisper_welcome_pending', '1');
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
      var currentPetRect = wrapper.getBoundingClientRect();
      box.style.left = (currentPetRect.left + currentPetRect.width / 2) + 'px';
      box.style.top = (currentPetRect.top + currentPetRect.height / 2) + 'px';
      box.style.transform = 'translate(-50%,-50%) scale(0.16)';
      box.style.opacity = '0';
      overlay.style.background = 'rgba(255,255,255,0)';

      setTimeout(function() {
        overlay.remove();
        modalOpen = false;
        resumeRoaming(0);
      }, 500);
    });
    
    // Enter 键
    pwdInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submitBtn.click();
    });
    
    setTimeout(function() { pwdInput.focus(); }, 600);
  });
})();
