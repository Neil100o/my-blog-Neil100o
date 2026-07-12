# Spine 2.1 播放工具核心代码提取报告

## 一、库文件清单

| 文件名 | 路径 | 大小 | 说明 |
|--------|------|------|------|
| `pixi.js` | `js/pixi.js` | 1.36 MB | PixiJS 主库（v4 或 v5 早期版本） |
| `pixi-spine-sjzs.js` | `js/pixi-spine-sjzs.js` | 139 KB | **pixi-spine 1.0.10 + GF SD Data patches** |
| `pixi-filters-v2.7.1.js` | `js/pixi-filters-v2.7.1.js` | 84 KB | PixiJS 滤镜库 |
| `pixi-layers.js` | `js/pixi-layers.js` | 29 KB | PixiJS 层级管理 |
| `skb.js` | `js/skb.js` | 27 KB | **Spine 2.1 二进制 .skel 读取器** |
| `TDoll.js` | `js/TDoll.js` | 325 B | Spine 角色封装类 |
| `TDGroup.js` | `js/TDGroup.js` | 1.7 KB | 多角色组管理类 |

### 关键依赖加载顺序（来自 `spine-gif.html`）

```html
<script src="js/pixi.js"></script>
<script src="js/pixi-spine-sjzs.js"></script><!-- 1.0.10 -->
<script src="js/pixi-filters-v2.7.1.js"></script>
<script src="js/pixi-layers.js"></script>
<script src="js/skb.js"></script>
<script src="js/TDoll.js"></script>
<script src="js/TDGroup.js"></script>
```

---

## 二、核心播放代码提取

### 2.1 PixiJS Application 初始化

```javascript
// 来自 spine_gif.js (编译后的 ClojureScript)
spine_gif_extract.core.app = new PIXI.Application(
  width, height, 
  {
    transparent: true,
    antialias: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true
  }
);

// Stage 设置（使用 pixi-layers）
spine_gif_extract.core.app.stage = new PIXI.display.Stage;
spine_gif_extract.core.stage = spine_gif_extract.core.app.stage;

// 容器层级
spine_gif_extract.core.cntr = new PIXI.Container();     // 主容器
spine_gif_extract.core.tgroup = new TDGroup();           // 角色组
spine_gif_extract.core.cntr.addChild(spine_gif_extract.core.tgroup);
```

### 2.2 Spine 2.1 二进制 .skel 加载流程

**关键：使用 `skb.js` 中的 `SkeletonBinary` 将二进制 .skel 转为 JSON，再用 `pixi-spine-sjzs.js` 解析。**

```javascript
// ========== 步骤 1: 读取二进制 .skel 并转为 JSON ==========
// 来自 skb.js
function SkeletonBinary() {
  this.data = null;
  this.scale = 1;
  this.json = {};
  this.nextNum = 0;
  this.chars = null;
}

SkeletonBinary.prototype.initJson = function () {
  this.json.skeleton = {};
  var skeleton = this.json.skeleton;
  skeleton.hash = this.readString();
  skeleton.spine = this.readString();  // 读取版本号，如 "2.1.27"
  skeleton.width = this.readFloat();
  skeleton.height = this.readFloat();
  // ... 读取 bones, slots, skins, animations 等
  return this.json;  // 返回标准 Spine JSON 对象
};

// 使用方式：
var skelBinary = new SkeletonBinary();
skelBinary.data = new Uint8Array(skelFileArrayBuffer);  // .skel 二进制数据
skelBinary.initJson();
var spineJson = skelBinary.json;  // 得到 JSON 格式的 skeleton data
```

**版本检查**：`skb.js` 和 `pixi-spine-sjzs.js` 都会检查 spine 版本：
```javascript
// 如果版本以 "3." 开头，会跳转到 chibi-gif（不支持 Spine 3.x）
var v = skeletonData.version || "";
if (v.startsWith("3.")) {
  goto_c2g();  // 提示用户去使用 Spine 3.x 工具
  return;
}
```

### 2.3 Atlas 和纹理加载

```javascript
// ========== 步骤 2: 加载 Atlas 文件 ==========
var atlasText = /* .atlas 文件的文本内容 */;

// 创建 Atlas 读取器
var atlasReader = new PIXI.spine.SpineRuntime.AtlasReader(atlasText);

// 创建 Atlas 对象
var spineAtlas = new PIXI.spine.SpineRuntime.Atlas(
  atlasText,
  function(line, callback) {
    // 纹理加载回调
    // line 是 atlas 中引用的图片文件名（如 "texture.png"）
    var texture = new PIXI.BaseTexture(imageElementOrBlob);
    callback(texture);
  },
  function(atlas) {
    // atlas 加载完成回调
    fn_cb_atlas_after_load(atlas);
  }
);

// ========== 步骤 3: 解析 Skeleton Data ==========
var attachmentParser = new PIXI.spine.SpineRuntime.AtlasAttachmentParser(spineAtlas);
var skeletonJsonParser = new PIXI.spine.SpineRuntime.SkeletonJsonParser(attachmentParser);
var skeletonData = skeletonJsonParser.readSkeletonData(spineJson, "Doll");

// 保存 atlas 引用（可选）
skeletonData._sp_atlas = spineAtlas;
```

### 2.4 创建 Spine 动画实例

```javascript
// ========== 步骤 4: 创建 Spine 实例 ==========

// 方式 A: 直接使用 TDoll 类（推荐，封装了 flipX 等）
class TDoll extends PIXI.spine.Spine {
  constructor(skel) {
    super(skel);
    this._default_right = true;
  }

  set facingRight(right) {
    this.skeleton.flipX = this._default_right ^ right;
  }

  get facingRight() {
    return this._default_right ^ this.skeleton.flipX ? true : false;
  }
}

// 方式 B: 直接使用 PIXI.spine.Spine
var doll = new PIXI.spine.Spine(skeletonData);

// 或从缓存加载（如果通过 Loader 加载过）
var doll = PIXI.spine.Spine.fromAtlas("resourceName");
```

### 2.5 播放动画

```javascript
// ========== 步骤 5: 播放动画 ==========

// 清除当前轨道上的所有动画
doll.state.clearTracks();

// 设置并播放单个动画（清除队列）
// trackIndex=0, animationName="wait", loop=true
doll.state.setAnimationByName(0, "wait", true);

// 添加动画到队列（不中断当前动画）
// trackIndex=0, animationName="move", loop=false, delay=0
doll.state.addAnimationByName(0, "move", false, 0);

// 手动更新一帧（用于截图/逐帧导出）
doll.update(0);

// 或启用自动更新（用于实时播放）
PIXI.spine.Spine.globalAutoUpdate = true;
doll.autoUpdate = true;
```

### 2.6 设置缩放和位置

```javascript
// ========== 缩放 ==========
// 设置整体缩放
doll.scale.set(1.0);  // 或 doll.scale.set(scaleX, scaleY);

// 来自工具的代码：
// spine_gif_extract.core.change_scale_xy = function(doll) {
//   var scale = parseFloat(document.getElementById('scale_xy').value);
//   doll.scale.set(scale);
// };

// ========== 位置 ==========
// 设置位置
doll.position.set(x, y);
// 或
doll.position.x = x;
doll.position.y = y;

// 来自工具的默认位置：
// pos_x = width / 2 (默认 180)
// pos_y = height * 0.75 (默认 252)

// ========== 翻转 ==========
// 水平翻转
doll.skeleton.flipX = true;
// 或使用 TDoll 的封装
doll.facingRight = false;
```

### 2.7 循环播放与动画切换

```javascript
// ========== 动画队列与循环 ==========

// 多动画队列（最后一个循环）
var motions = ["wait", "move", "attack"];
var loopLast = true;  // 是否循环最后一个动画

doll.state.clearTracks();

motions.forEach(function(animName, index) {
  var isLast = (index === motions.length - 1);
  var shouldLoop = isLast && loopLast;
  doll.state.addAnimationByName(0, animName, shouldLoop, 0);
});

doll.update(0);  // 初始化第一帧

// 自动更新开关
function setAutoUpdate(enable) {
  PIXI.spine.Spine.globalAutoUpdate = enable;
}

// 来自工具的 ticker 监听：
// 每帧检查动画状态，更新时间线 UI
function tickerListener(delta) {
  if (PIXI.spine.Spine.globalAutoUpdate) {
    var track = doll.state.tracks[0];
    if (track) {
      var currentTime = track.time % track.endTime;
      updateTimelineUI(currentTime);
    }
  }
}
```

---

## 三、完整加载流程示例（可移植到 secret-trigger.js）

```javascript
// ============================================
// Spine 2.1 播放器 - 核心代码（移植版）
// ============================================

// 依赖（按顺序加载）：
// 1. pixi.js
// 2. pixi-spine-sjzs.js
// 3. skb.js

// 1. 初始化 PixiJS
var app = new PIXI.Application(400, 400, {
  transparent: true,
  antialias: true,
  premultipliedAlpha: true,
  preserveDrawingBuffer: true
});
document.body.appendChild(app.view);

// 2. 加载资源（.skel 二进制, .atlas 文本, .png 纹理）
function loadSpineData(skelBuffer, atlasText, pngImage) {
  // 2.1 将二进制 .skel 转为 JSON
  var skelBinary = new SkeletonBinary();
  skelBinary.data = new Uint8Array(skelBuffer);
  skelBinary.initJson();
  var spineJson = skelBinary.json;
  
  // 2.2 创建 Atlas
  var spineAtlas = new PIXI.spine.SpineRuntime.Atlas(
    atlasText,
    function(line, callback) {
      // 加载纹理
      callback(new PIXI.BaseTexture(pngImage));
    },
    function(atlas) {
      console.log("Atlas loaded");
    }
  );
  
  // 2.3 解析 Skeleton Data
  var attachmentParser = new PIXI.spine.SpineRuntime.AtlasAttachmentParser(spineAtlas);
  var skeletonJsonParser = new PIXI.spine.SpineRuntime.SkeletonJsonParser(attachmentParser);
  var skeletonData = skeletonJsonParser.readSkeletonData(spineJson, "Doll");
  
  // 2.4 创建 Spine 实例
  var doll = new PIXI.spine.Spine(skeletonData);
  
  // 2.5 设置位置和缩放
  doll.position.set(200, 300);  // 居中偏下
  doll.scale.set(1.0);
  
  // 2.6 添加到舞台
  app.stage.addChild(doll);
  
  // 2.7 播放动画
  doll.state.setAnimationByName(0, "wait", true);  // 循环播放 wait
  
  return doll;
}

// 3. 动画切换示例
function playAnimation(doll, animName, loop) {
  doll.state.clearTracks();
  doll.state.setAnimationByName(0, animName, loop);
}

// 4. 队列播放示例（等待动画 + 移动动画）
function queueAnimations(doll, animList, loopLast) {
  doll.state.clearTracks();
  animList.forEach(function(name, idx) {
    var isLast = (idx === animList.length - 1);
    doll.state.addAnimationByName(0, name, isLast && loopLast, 0);
  });
}

// 使用：
// queueAnimations(doll, ["wait", "move"], true);
// 先播放 wait，然后播放 move，move 循环播放
```

---

## 四、版本相关注意事项

### 4.1 pixi-spine-sjzs.js 版本特性
- **版本**: `pixi-spine 1.0.10 + patches for GF SD Data`
- **Spine 运行时版本**: 2.1.x（明确不支持 3.x）
- **API 命名空间**: `PIXI.spine.SpineRuntime.*` 和 `PIXI.spine.Spine`

### 4.2 与现代 pixi-spine 的区别
| 特性 | 本工具 (1.0.10) | 现代 pixi-spine |
|------|----------------|----------------|
| 命名空间 | `PIXI.spine.SpineRuntime` | `PIXI.spine.core` |
| 加载方式 | `SkeletonBinary` + `SkeletonJsonParser` | `SpineParser` 或 AssetLoader |
| 动画方法 | `setAnimationByName`, `addAnimationByName` | `setAnimation`, `addAnimation` |
| 自动更新 | `Spine.globalAutoUpdate` | `autoUpdate` 属性 |
| Spine 版本 | 仅 2.1.x | 3.8+ / 4.0+ |

### 4.3 关键限制
1. **仅支持 Spine 2.1.x**：`.skel` 二进制格式和 JSON 结构都是 2.1 版本的
2. **需要 `skb.js`**：没有内置的二进制解析器，必须额外加载 `skb.js`
3. **PMA 处理**：工具支持 `un-PMA`（取消预乘 Alpha），通过 `window.skip_unpma` 控制
4. **Atlas 格式**：使用标准 Spine Atlas 文本格式

### 4.4 与现代 PixiJS 的兼容性
- 工具的 `pixi.js` 是 **v4.x 或早期 v5** 版本
- `pixi-spine-sjzs.js` 依赖 `PIXI.Container`、`PIXI.BaseTexture` 等 v4 API
- 如果博客使用 **PixiJS v7+**，需要：
  - 使用兼容的 `pixi-spine` 版本（如 `pixi-spine@4.x` for Spine 3.8/4.0）
  - 或继续使用旧版 PixiJS + 旧版 pixi-spine
  - **注意**：Spine 2.1 数据需要升级到 3.8+ 才能被现代 pixi-spine 读取

---

## 五、文件结构总结

```
spine-gif/
├── spine-gif.html          # 主页面（加载所有脚本）
├── css/
├── img/
└── js/
    ├── pixi.js              # PixiJS 主库 (~v4)
    ├── pixi-spine-sjzs.js   # pixi-spine 1.0.10 + patches
    ├── pixi-filters-v2.7.1.js
    ├── pixi-layers.js
    ├── skb.js               # Spine 2.1 二进制读取器 ⭐
    ├── TDoll.js             # Spine 角色类 ⭐
    ├── TDGroup.js           # 角色组管理
    ├── main.js              # 页面交互辅助函数
    └── compiled/
        └── spine_gif.js     # 主逻辑（ClojureScript 编译）
```

---

## 六、移植建议

### 方案 A: 保持原样（推荐，如果已有资源是 Spine 2.1）
1. 复制 `pixi.js`、`pixi-spine-sjzs.js`、`skb.js`、`TDoll.js`、`TDGroup.js` 到博客
2. 按上述"完整加载流程示例"编写 `secret-trigger.js`
3. 使用 `PIXI.spine.Spine` 和 `SkeletonBinary` 加载 .skel 文件

### 方案 B: 升级到现代 Spine（如果需要新功能）
1. 使用工具的"导出 Spine 3.8"功能将 2.1 数据升级
2. 使用现代 `pixi-spine`（支持 Spine 3.8/4.0）
3. 现代 API 差异较大，需重写加载逻辑

### 方案 C: 预渲染为 GIF/PNG 序列
1. 使用原工具生成动画帧/GIF
2. 在博客中直接播放图片序列或 GIF
3. 无需引入任何 Spine 库
