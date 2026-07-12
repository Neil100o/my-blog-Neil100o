const fs = require('fs');

// ========== SkeletonBinary Reader (from skb.js) ==========
function SkeletonBinary() {
  this.data = null;
  this.scale = 1;
  this.json = {};
  this.nextNum = 0;
  this.chars = null;
}

SkeletonBinary.prototype = {
  BlendMode: ["normal", "additive", "multiply", "screen"],
  AttachmentType: ["region", "boundingbox", "mesh", "skinnedmesh"],

  readByte: function () {
    return this.nextNum < this.data.length ? this.data[this.nextNum++] : null;
  },
  readBoolean: function () {
    return this.readByte() != 0;
  },
  readShort: function () {
    return (this.readByte() << 8) | this.readByte();
  },
  readInt: function (optimizePositive) {
    if (typeof optimizePositive === 'undefined') {
      return (this.readByte() << 24) | (this.readByte() << 16) | (this.readByte() << 8) | this.readByte();
    }
    var b = this.readByte();
    var result = b & 0x7f;
    if ((b & 0x80) != 0) {
      b = this.readByte();
      result |= (b & 0x7F) << 7;
      if ((b & 0x80) != 0) {
        b = this.readByte();
        result |= (b & 0x7F) << 14;
        if ((b & 0x80) != 0) {
          b = this.readByte();
          result |= (b & 0x7F) << 21;
          if ((b & 0x80) != 0) {
            b = this.readByte();
            result |= (b & 0x7F) << 28;
          }
        }
      }
    }
    return optimizePositive ? result : ((result >> 1) ^ -(result & 1));
  },
  bytes2Float32: function (bytes) {
    var sign = (bytes & 0x80000000) ? -1 : 1;
    var exponent = ((bytes >> 23) & 0xFF) - 127;
    var significand = (bytes & ~(-1 << 23));

    if (exponent == 128)
      return sign * ((significand) ? Number.NaN : Number.POSITIVE_INFINITY);

    if (exponent == -127) {
      if (significand == 0) return sign * 0.0;
      exponent = -126;
      significand /= (1 << 22);
    } else significand = (significand | (1 << 23)) / (1 << 23);

    return sign * significand * Math.pow(2, exponent);
  },
  readFloat: function () {
    return this.bytes2Float32((this.readByte() << 24) + (this.readByte() << 16) + (this.readByte() << 8) + this.readByte());
  },
  readFloatArray: function () {
    var n = this.readInt(true);
    var array = new Array(n);
    if (this.scale == 1) {
      for (var i = 0; i < n; i++) {
        array[i] = this.readFloat();
      }
    } else {
      for (var i = 0; i < n; i++) {
        array[i] = this.readFloat() * this.scale;
      }
    }
    return array;
  },
  readShortArray: function () {
    var n = this.readInt(true);
    var array = new Array(n);
    for (var i = 0; i < n; i++) {
      array[i] = this.readShort();
    }
    return array;
  },
  readIntArray: function () {
    var n = this.readInt(true);
    var array = new Array(n);
    for (var i = 0; i < n; i++)
      array[i] = this.readInt(true);
    return array;
  },
  readHex: function () {
    var hex = this.readByte().toString(16);
    return hex.length == 2 ? hex : '0' + hex;
  },
  readColor: function () {
    return this.readHex() + this.readHex() + this.readHex() + this.readHex();
  },
  readUtf8_slow: function (charCount, charIndex, b) {
    while (true) {
      switch (b >> 4) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
          this.chars += String.fromCharCode(b);
          break;
        case 12:
        case 13:
          this.chars += String.fromCharCode((b & 0x1F) << 6 | this.readByte() & 0x3F);
          break;
        case 14:
          this.chars += String.fromCharCode((b & 0x0F) << 12 | (this.readByte() & 0x3F) << 6 | this.readByte() & 0x3F);
          break;
      }
      if (++charIndex >= charCount) break;
      b = this.readByte() & 0xFF;
    }
  },
  readString: function () {
    var charCount = this.readInt(this, true);
    switch (charCount) {
      case 0:
        return null;
      case 1:
        return "";
    }
    charCount--;
    this.chars = "";
    var b = 0;
    var charIndex = 0;
    while (charIndex < charCount) {
      b = this.readByte();
      if (b > 127)
        break;
      this.chars += String.fromCharCode(b);
      charIndex++;
    }
    if (charIndex < charCount)
      this.readUtf8_slow(charCount, charIndex, b);
    return this.chars;
  },
  initJson: function () {
    this.json.skeleton = {};
    var skeleton = this.json.skeleton;
    skeleton.hash = this.readString();
    if (skeleton.hash.length == 0)
      skeleton.hash = null;
    skeleton.spine = this.readString();
    if (skeleton.spine.length == 0)
      skeleton.spine = null;
    skeleton.width = this.readFloat();
    skeleton.height = this.readFloat();
    var nonessential = this.readBoolean();
    skeleton.nonessential = nonessential;
    if (nonessential) {
      skeleton.images = this.readString();
      if (skeleton.images.length == 0)
        skeleton.images = null;
    }

    //Bones.
    this.json.bones = new Array(this.readInt(true));
    var bones = this.json.bones;
    for (var i = 0; i < bones.length; i++) {
      var boneData = {};
      boneData.name = this.readString();
      boneData.parent = null;
      var parentIndex = this.readInt(true) - 1;
      if (parentIndex != -1)
        boneData.parent = bones[parentIndex].name;
      var x = this.readFloat() * this.scale;
      if (x != 0) boneData.x = x;
      var y = this.readFloat() * this.scale;
      if (y != 0) boneData.y = y;
      var sx = this.readFloat();
      if (sx != 1) boneData.scaleX = sx;
      var sy = this.readFloat();
      if (sy != 1) boneData.scaleY = sy;
      var rot = this.readFloat();
      if (rot != 0) boneData.rotation = rot;
      var length = this.readFloat() * this.scale;
      if (length != 0) boneData.length = length;
      var flipX = this.readBoolean();
      if (flipX) boneData.flipX = flipX;
      var flipY = this.readBoolean();
      if (flipY) boneData.flipY = flipY;
      var inheritScale = this.readBoolean();
      if (!inheritScale) boneData.inheritScale = inheritScale;
      var inheritRotation = this.readBoolean();
      if (!inheritRotation) boneData.inheritRotation = inheritRotation;

      if (nonessential) {
        var color = this.readColor();
        if (color != "ffffffff") boneData.color = color;
      }
      bones[i] = boneData;
    }

    // IK constraints.
    var ikIndex = this.readInt(true);
    if (ikIndex > 0) {
      this.json.ik = new Array(ikIndex);
      var ik = this.json.ik;
      for (var i = 0; i < ikIndex; i++) {
        var ikConstraints = {};
        ikConstraints.name = this.readString();
        ikConstraints.bones = new Array(this.readInt(true));
        for (var j = 0; j < ikConstraints.bones.length; j++) {
          ikConstraints.bones[j] = this.json.bones[this.readInt(true)].name;
        }
        ikConstraints.target = this.json.bones[this.readInt(true)].name;
        ikConstraints.mix = this.readFloat();
        ikConstraints.bendPositive = this.readBoolean();
        ik[i] = ikConstraints;
      }
    }

    // Slots.
    this.json.slots = new Array(this.readInt(true));
    var slots = this.json.slots;
    for (var i = 0; i < slots.length; i++) {
      var slotData = {};
      slotData.name = this.readString();
      var boneData = this.json.bones[this.readInt(true)];
      slotData.bone = boneData.name;
      var color1 = this.readColor();
      if (color1 != "ffffffff") slotData.color = color1;
      slotData.attachment = this.readString();
      var blend = this.BlendMode[this.readInt(true)];
      if (blend !== "normal") slotData.blend = blend;
      slots[i] = slotData;
    }

    // Default skin.
    this.json.skins = {};
    this.json.skinsName = new Array();
    var skins = this.json.skins;
    var defaultSkin = this.readSkin("default", nonessential);
    if (defaultSkin != null) {
      skins["default"] = defaultSkin;
      this.json.skinsName.push("default");
    }

    // Skin.
    const skin_n = this.readInt(true);
    for (var i = 0; i < skin_n; i++) {
      var skinName = this.readString();
      var skin = this.readSkin(skinName, nonessential);
      skins[skinName] = skin;
      this.json.skinsName.push(skinName);
    }

    // Events.
    this.json.events = {};
    this.json.eventsName = [];
    var events = this.json.events;
    for (var i = 0, n = this.readInt(true); i < n; i++) {
      var eventName = this.readString();
      var event = {};
      event.int = this.readInt(false);
      event.float = this.readFloat();
      event.string = this.readString();
      events[eventName] = event;
      this.json.eventsName[i] = eventName;
    }

    // Animations.
    this.json.animations = {};
    var animations = this.json.animations;

    for (var i = 0, n = this.readInt(true); i < n; i++) {
      var animationName = this.readString();
      var animation = this.readAnimation(animationName);
      animations[animationName] = animation;
    }
  },
  readSkin: function (skinName, nonessential) {
    var slotCount = this.readInt(true);
    if (slotCount === 0)
      return null;
    var skin = {};
    for (var i = 0; i < slotCount; i++) {
      var slotIndex = this.readInt(true);
      var slot = {};
      for (var j = 0, n = this.readInt(true); j < n; j++) {
        var name = this.readString();
        var attachment = this.readAttachment(name, nonessential);
        slot[name] = attachment;
      }
      skin[this.json.slots[slotIndex].name] = slot;
    }
    return skin;
  },
  readAttachment: function (attachmentName, nonessential) {
    var name = this.readString();
    if (name == null)
      name = attachmentName;
    var ty = this.AttachmentType[this.readByte()];
    switch (ty) {
      case "region":
        var path = this.readString();
        if (path == null)
          path = name;
        var region = {};
        region.type = "region";
        region.name = name;
        region.path = path;
        var x = this.readFloat() * this.scale;
        if (x != 0) region.x = x;
        var y = this.readFloat() * this.scale;
        if (y != 0) region.y = y;
        var sx = this.readFloat();
        if (sx != 1) region.scaleX = sx;
        var sy = this.readFloat();
        if (sy != 1) region.scaleY = sy;
        var rot = this.readFloat();
        if (rot != 0) region.rotation = rot;
        region.width = this.readFloat() * this.scale;
        region.height = this.readFloat() * this.scale;
        var color = this.readColor();
        if (color != "ffffffff") region.color = color;
        return region;
      case "boundingbox":
        var box = {};
        box.type = "boundingbox";
        box.name = name;
        box.vertices = this.readFloatArray();
        return box;
      case "mesh":
        var path = this.readString();
        if (path == null)
          path = name;
        var mesh = {};
        mesh.type = "mesh";
        mesh.name = name;
        mesh.path = path;
        mesh.uvs = this.readFloatArray();
        mesh.triangles = this.readShortArray();
        mesh.vertices = this.readFloatArray();
        mesh.color = this.readColor();
        mesh.hull = this.readInt(true);
        if (nonessential) {
          mesh.edges = this.readIntArray();
          mesh.width = this.readFloat();
          mesh.height = this.readFloat();
        }
        return mesh;
      case "skinnedmesh":
        var path = this.readString();
        if (path == null)
          path = name;
        var skinnedmesh = {};
        skinnedmesh.type = "skinnedmesh";
        skinnedmesh.name = name;
        skinnedmesh.path = path;
        skinnedmesh.uvs = this.readFloatArray();
        skinnedmesh.triangles = this.readShortArray();

        skinnedmesh.vertices = new Array();
        var vertexCount = this.readInt(true);
        for (var i = 0; i < vertexCount;) {
          var boneCount = Math.floor(this.readFloat());
          skinnedmesh.vertices[i++] = boneCount;
          for (var nn = i + boneCount * 4; i < nn; i += 4) {
            skinnedmesh.vertices[i] = Math.floor(this.readFloat());
            skinnedmesh.vertices[i + 1] = this.readFloat();
            skinnedmesh.vertices[i + 2] = this.readFloat();
            skinnedmesh.vertices[i + 3] = this.readFloat();
          }
        }
        skinnedmesh.color = this.readColor();
        skinnedmesh.hull = this.readInt(true);
        if (nonessential) {
          skinnedmesh.edges = this.readIntArray();
          skinnedmesh.width = this.readFloat();
          skinnedmesh.height = this.readFloat();
        }
        return skinnedmesh;
    }
    return null;
  },
  readCurve: function (frameIndex, timeline) {
    switch (this.readByte()) {
      case 1: //CURVE_STEPPED
        timeline[frameIndex].curve = "stepped";
        break;
      case 2: //CURVE_BEZIER
        var cx1 = this.readFloat();
        var cy1 = this.readFloat();
        var cx2 = this.readFloat();
        var cy2 = this.readFloat();
        timeline[frameIndex].curve = [cx1, cy1, cx2, cy2];
    }
  },
  readAnimation: function (name) {
    var animation = {};
    var scale = this.scale;
    var duration = 0;

    // Slot timelines.
    var slots = {};
    for (var i = 0, n = this.readInt(true); i < n; i++) {
      var slotIndex = this.readInt(true);
      var slotMap = {};
      var timeCount = this.readInt(true);
      for (var ii = 0; ii < timeCount; ii++) {
        var timelineType = this.readByte();
        var frameCount = this.readInt(true);
        switch (timelineType) {
          case 4: //TIMELINE_COLOR
            var timeline = new Array(frameCount);
            for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
              var time = this.readFloat();
              var color = this.readColor();
              timeline[frameIndex] = {};
              timeline[frameIndex].time = time;
              timeline[frameIndex].color = color;
              if (frameIndex < frameCount - 1) {
                var str = this.readCurve(frameIndex, timeline);
              }
            }
            slotMap.color = timeline;
            duration = Math.max(duration, timeline[frameCount - 1].time);
            break;
          case 3: //TIMELINE_ATTACHMENT
            var timeline = new Array(frameCount);
            for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
              var time = this.readFloat();
              var attachmentName = this.readString();
              timeline[frameIndex] = {};
              timeline[frameIndex].time = time;
              timeline[frameIndex].name = attachmentName;
            }
            slotMap.attachment = timeline;
            duration = Math.max(duration, timeline[frameCount - 1].time);
            break;
        }
      }
      slots[this.json.slots[slotIndex].name] = slotMap;
    }
    animation.slots = slots;

    //// Bone timelines.
    var bones = {};
    for (var i = 0, n = this.readInt(true); i < n; i++) {
      var boneIndex = this.readInt(true);
      var boneMap = {};
      for (var ii = 0, nn = this.readInt(true); ii < nn; ii++) {
        var timelineType = this.readByte();
        var frameCount = this.readInt(true);
        switch (timelineType) {
          case 1: //TIMELINE_ROTATE
            var timeline = new Array(frameCount);
            for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
              var tltime = this.readFloat();
              var tlangle = this.readFloat();
              timeline[frameIndex] = {};
              timeline[frameIndex].time = tltime;
              timeline[frameIndex].angle = tlangle;
              if (frameIndex < frameCount - 1) {
                this.readCurve(frameIndex, timeline);
              }
            }
            boneMap.rotate = timeline;
            duration = Math.max(duration, timeline[frameCount - 1].time);
            break;
          case 2: //TIMELINE_TRANSLATE
          case 0: //TIMELINE_SCALE
            var timeline = new Array(frameCount);
            var timelineScale = 1;
            if (timelineType == 2) {
              timelineScale = scale;
            }
            for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
              var tltime = this.readFloat();
              var tlx = this.readFloat();
              var tly = this.readFloat();
              timeline[frameIndex] = {};
              timeline[frameIndex].time = tltime;
              timeline[frameIndex].x = tlx;
              timeline[frameIndex].y = tly;
              if (frameIndex < frameCount - 1) {
                this.readCurve(frameIndex, timeline);
              }
            }
            if (timelineType == 0) {
              boneMap.scale = timeline;
            } else {
              boneMap.translate = timeline;
            }
            duration = Math.max(duration, timeline[frameCount - 1].time);
            break;
          case 5: //TIMELINE_FLIPX
          case 6: //TIMELINE_FLIPY
            var timeline = new Array(frameCount);
            for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
              var tltime = this.readFloat();
              var tlflip = this.readBoolean();
              timeline[frameIndex] = {};
              timeline[frameIndex].time = tltime;
              if (timelineType == 5)
                timeline[frameIndex].x = tlflip;
              else
                timeline[frameIndex].y = tlflip;
            }
            if (timelineType == 5)
              boneMap.flipX = timeline;
            else
              boneMap.flipY = timeline;
            duration = Math.max(duration, timeline[frameCount - 1].time);
            break;
        }
      }
      bones[this.json.bones[boneIndex].name] = boneMap;
    }
    animation.bones = bones;

    // IK timelines.
    var ik = {};
    {
      var n0 = this.readInt(true);
      for (var i = 0, n = n0; i < n; i++) {
        var ikIndex = this.readInt(true);
        var frameCount = this.readInt(true);
        var timeline = new Array(frameCount);
        for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
          var timelineMap = {};
          var time = this.readFloat();
          var mix = this.readFloat();
          var bendPositive = this.readBoolean();
          timeline[frameIndex] = {};
          timeline[frameIndex].time = time;
          timeline[frameIndex].mix = mix;
          timeline[frameIndex].bendPositive = bendPositive;
          if (frameIndex < frameCount - 1)
            this.readCurve(frameIndex, timeline);
        }
        ik[this.json.ik[ikIndex].name] = timeline;
      }
    }
    animation.ik = ik;

    // FFD timelines.
    var ffd = {};
    const ffd_n = this.readInt(true);
    for (var i = 0, n = ffd_n; i < n; i++) {
      var skinIndex = this.readInt(true);
      var slotMap = {};
      for (var ii = 0, nn = this.readInt(true); ii < nn; ii++) {
        var slotIndex = this.readInt(true);
        var meshMap = {};
        var slot = this.json.slots[slotIndex];
        var nnn = this.readInt(true);
        for (var iii = 0; iii < nnn; iii++) {
          var meshName = this.readString();
          var frameCount = this.readInt(true);
          var attachment;
          var attachments = this.json.skins[this.json.skinsName[skinIndex]][slot.name];
          for (var attachmentName in attachments) {
            if (attachments[attachmentName].name == meshName) {
              attachment = attachments[attachmentName];
              break;
            }
          }
          if (!attachment) {
            for (var attachmentName in attachments) {
              if (attachmentName === meshName) {
                attachment = attachments[attachmentName];
                break;
              }
            }
          }
          if (!attachment) {
            var error_msg = "FFD attachment not found: " + meshName;
            console.log(error_msg);
            throw error_msg;
          }

          var timeline = new Array(frameCount);
          for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
            var time = this.readFloat();
            var vertexCount;
            if (attachment.type == "mesh") {
              vertexCount = attachment.vertices.length;
            } else {
              vertexCount = attachment.uvs.length * 3 * 3;
            }

            var vertices = new Array(vertexCount);
            for (var verticeIdx = 0; verticeIdx < vertexCount; verticeIdx++) {
              vertices[verticeIdx] = 0.0;
            }

            var bugFixMultiplicator = 0.1;

            var end = this.readInt(true);
            if (end == 0) {
              if (attachment.type == "mesh") {
                for (var verticeIdx = 0; verticeIdx < vertexCount; verticeIdx++) {
                  vertices[verticeIdx] += attachment.vertices[verticeIdx] * bugFixMultiplicator;
                }
              }
            } else {
              var start = this.readInt(true);
              end += start;

              for (var v = start; v < end; v++) {
                vertices[v] = this.readFloat() * scale;
              }

              if (attachment.type == "mesh") {
                var meshVertices = attachment.vertices;
                for (var v = 0, vn = vertices.length; v < vn; v++) {
                  vertices[v] += meshVertices[v] * bugFixMultiplicator;
                }
              }
            }
            timeline[frameIndex] = {};
            timeline[frameIndex].time = time;
            timeline[frameIndex].vertices = vertices;

            if (frameIndex < frameCount - 1)
              this.readCurve(frameIndex, timeline);
          }
          meshMap[meshName] = timeline;
          duration = Math.max(duration, timeline[frameCount - 1].time);
        }
        slotMap[slot.name] = meshMap;
      }
      ffd[this.json.skinsName[skinIndex]] = slotMap;
    }
    animation.ffd = ffd;

    // Draw order timeline.
    var drawOrderCount = this.readInt(true);
    if (drawOrderCount > 0) {
      var drawOrders = new Array(drawOrderCount);
      var slotCount = this.json.slots.length;
      for (var i = 0; i < drawOrderCount; i++) {
        var drawOrderMap = {};
        var offsetCount = this.readInt(true);
        var offsets = new Array(offsetCount);
        for (var ii = 0; ii < offsetCount; ii++) {
          var offsetMap = {};
          var slotIndex = this.readInt(true);
          offsetMap.slot = this.json.slots[slotIndex].name;
          var dooffset = this.readInt(true);
          offsetMap.offset = dooffset;
          offsets[ii] = offsetMap;
        }
        drawOrderMap.offsets = offsets;
        var tltime = this.readFloat();
        drawOrderMap.time = tltime;
        drawOrders[i] = drawOrderMap;
      }
      duration = Math.max(duration, drawOrders[drawOrderCount - 1].time);
      animation.drawOrder = drawOrders;
    }

    // Event timeline.
    var eventCount = this.readInt(true);
    if (eventCount > 0) {
      var events = new Array(eventCount);
      for (var i = 0; i < eventCount; i++) {
        var time = this.readFloat();
        var name = this.json.eventsName[this.readInt(true)];
        var eventData = this.json.events[name];
        var e = {};
        e.name = name;
        e.int = this.readInt(true);
        e.float = this.readFloat();
        e.string = this.readBoolean() ? this.readString() : eventData.string;
        e.time = time;
        events[i] = e;
      }
      duration = Math.max(duration, events[eventCount - 1].time);
      animation.events = events;
    }
    return animation;
  }
};

// ========== SkeletonBinary Writer ==========
function SkeletonBinaryWriter() {
  this.data = [];
}

SkeletonBinaryWriter.prototype = {
  writeByte: function (b) {
    this.data.push(b & 0xFF);
  },
  writeBoolean: function (v) {
    this.writeByte(v ? 1 : 0);
  },
  writeShort: function (v) {
    this.writeByte((v >> 8) & 0xFF);
    this.writeByte(v & 0xFF);
  },
  writeInt: function (value, optimizePositive) {
    if (typeof optimizePositive === 'undefined') {
      this.writeByte((value >> 24) & 0xFF);
      this.writeByte((value >> 16) & 0xFF);
      this.writeByte((value >> 8) & 0xFF);
      this.writeByte(value & 0xFF);
      return;
    }
    if (!optimizePositive) {
      value = (value << 1) ^ (value >> 31);
    }
    while (true) {
      if ((value & ~0x7F) == 0) {
        this.writeByte(value);
        return;
      }
      this.writeByte((value & 0x7F) | 0x80);
      value >>>= 7;
    }
  },
  float2Bytes: function (v) {
    // Convert JS float to 32-bit IEEE 754 bytes
    var buf = new ArrayBuffer(4);
    var view = new DataView(buf);
    view.setFloat32(0, v, false); // big-endian
    return [view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)];
  },
  writeFloat: function (v) {
    var bytes = this.float2Bytes(v);
    this.writeByte(bytes[0]);
    this.writeByte(bytes[1]);
    this.writeByte(bytes[2]);
    this.writeByte(bytes[3]);
  },
  writeFloatArray: function (arr) {
    this.writeInt(arr.length, true);
    for (var i = 0; i < arr.length; i++) {
      this.writeFloat(arr[i]);
    }
  },
  writeShortArray: function (arr) {
    this.writeInt(arr.length, true);
    for (var i = 0; i < arr.length; i++) {
      this.writeShort(arr[i]);
    }
  },
  writeIntArray: function (arr) {
    this.writeInt(arr.length, true);
    for (var i = 0; i < arr.length; i++) {
      this.writeInt(arr[i], true);
    }
  },
  writeColor: function (hex) {
    for (var i = 0; i < 8; i += 2) {
      this.writeByte(parseInt(hex.substr(i, 2), 16));
    }
  },
  writeString: function (str) {
    if (str == null) {
      this.writeInt(0, true);
      return;
    }
    if (str.length == 0) {
      this.writeInt(1, true);
      return;
    }
    var charCount = str.length + 1;
    this.writeInt(charCount, true);
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c <= 0x7F) {
        this.writeByte(c);
      } else {
        // Simple UTF-8 encoding for non-ASCII
        if (c <= 0x7FF) {
          this.writeByte(0xC0 | (c >> 6));
          this.writeByte(0x80 | (c & 0x3F));
        } else {
          this.writeByte(0xE0 | (c >> 12));
          this.writeByte(0x80 | ((c >> 6) & 0x3F));
          this.writeByte(0x80 | (c & 0x3F));
        }
      }
    }
  },
  writeSkeleton: function (json) {
    this.writeString(json.skeleton.hash);
    this.writeString(json.skeleton.spine);
    this.writeFloat(json.skeleton.width);
    this.writeFloat(json.skeleton.height);
    this.writeBoolean(json.skeleton.nonessential);
    if (json.skeleton.nonessential) {
      this.writeString(json.skeleton.images);
    }

    // Bones
    this.writeInt(json.bones.length, true);
    for (var i = 0; i < json.bones.length; i++) {
      var bone = json.bones[i];
      this.writeString(bone.name);
      var parentIndex = 0;
      if (bone.parent) {
        for (var j = 0; j < json.bones.length; j++) {
          if (json.bones[j].name === bone.parent) {
            parentIndex = j + 1;
            break;
          }
        }
      }
      this.writeInt(parentIndex, true);
      this.writeFloat(bone.x || 0);
      this.writeFloat(bone.y || 0);
      this.writeFloat(bone.scaleX || 1);
      this.writeFloat(bone.scaleY || 1);
      this.writeFloat(bone.rotation || 0);
      this.writeFloat(bone.length || 0);
      this.writeBoolean(bone.flipX || false);
      this.writeBoolean(bone.flipY || false);
      this.writeBoolean(bone.inheritScale !== false);
      this.writeBoolean(bone.inheritRotation !== false);
      if (json.skeleton.nonessential) {
        this.writeColor(bone.color || "ffffffff");
      }
    }

    // IK constraints
    if (json.ik) {
      this.writeInt(json.ik.length, true);
      for (var i = 0; i < json.ik.length; i++) {
        var ik = json.ik[i];
        this.writeString(ik.name);
        this.writeInt(ik.bones.length, true);
        for (var j = 0; j < ik.bones.length; j++) {
          for (var k = 0; k < json.bones.length; k++) {
            if (json.bones[k].name === ik.bones[j]) {
              this.writeInt(k, true);
              break;
            }
          }
        }
        for (var k = 0; k < json.bones.length; k++) {
          if (json.bones[k].name === ik.target) {
            this.writeInt(k, true);
            break;
          }
        }
        this.writeFloat(ik.mix);
        this.writeBoolean(ik.bendPositive);
      }
    } else {
      this.writeInt(0, true);
    }

    // Slots
    this.writeInt(json.slots.length, true);
    for (var i = 0; i < json.slots.length; i++) {
      var slot = json.slots[i];
      this.writeString(slot.name);
      for (var j = 0; j < json.bones.length; j++) {
        if (json.bones[j].name === slot.bone) {
          this.writeInt(j, true);
          break;
        }
      }
      this.writeColor(slot.color || "ffffffff");
      this.writeString(slot.attachment || null);
      var blendModeIndex = 0;
      if (slot.blend) {
        var blendModes = ["normal", "additive", "multiply", "screen"];
        blendModeIndex = blendModes.indexOf(slot.blend);
      }
      this.writeInt(blendModeIndex, true);
    }

    // Default skin
    this.writeSkin(json.skins["default"], json, json.skeleton.nonessential);

    // Skins
    var skinNames = json.skinsName.filter(function (n) { return n !== "default"; });
    this.writeInt(skinNames.length, true);
    for (var i = 0; i < skinNames.length; i++) {
      this.writeString(skinNames[i]);
      this.writeSkin(json.skins[skinNames[i]], json, json.skeleton.nonessential);
    }

    // Events
    this.writeInt(json.eventsName.length, true);
    for (var i = 0; i < json.eventsName.length; i++) {
      var eventName = json.eventsName[i];
      var event = json.events[eventName];
      this.writeString(eventName);
      this.writeInt(event.int, false);
      this.writeFloat(event.float);
      this.writeString(event.string);
    }

    // Animations
    var animNames = Object.keys(json.animations);
    this.writeInt(animNames.length, true);
    for (var i = 0; i < animNames.length; i++) {
      this.writeString(animNames[i]);
      this.writeAnimation(json.animations[animNames[i]], json);
    }
  },
  writeSkin: function (skin, json, nonessential) {
    if (!skin) {
      this.writeInt(0, true);
      return;
    }
    var slotNames = Object.keys(skin);
    this.writeInt(slotNames.length, true);
    for (var i = 0; i < slotNames.length; i++) {
      var slotName = slotNames[i];
      for (var j = 0; j < json.slots.length; j++) {
        if (json.slots[j].name === slotName) {
          this.writeInt(j, true);
          break;
        }
      }
      var attachments = skin[slotName];
      var attachmentNames = Object.keys(attachments);
      this.writeInt(attachmentNames.length, true);
      for (var k = 0; k < attachmentNames.length; k++) {
        var attName = attachmentNames[k];
        var att = attachments[attName];
        this.writeString(attName);
        this.writeAttachment(att, nonessential);
      }
    }
  },
  writeAttachment: function (att, nonessential) {
    this.writeString(att.name || null);
    var typeIndex = ["region", "boundingbox", "mesh", "skinnedmesh"].indexOf(att.type);
    this.writeByte(typeIndex);
    switch (att.type) {
      case "region":
        this.writeString(att.path || null);
        this.writeFloat(att.x || 0);
        this.writeFloat(att.y || 0);
        this.writeFloat(att.scaleX || 1);
        this.writeFloat(att.scaleY || 1);
        this.writeFloat(att.rotation || 0);
        this.writeFloat(att.width || 0);
        this.writeFloat(att.height || 0);
        this.writeColor(att.color || "ffffffff");
        break;
      case "boundingbox":
        this.writeFloatArray(att.vertices);
        break;
      case "mesh":
        this.writeString(att.path || null);
        this.writeFloatArray(att.uvs);
        this.writeShortArray(att.triangles);
        this.writeFloatArray(att.vertices);
        this.writeColor(att.color || "ffffffff");
        this.writeInt(att.hull, true);
        if (nonessential) {
          this.writeIntArray(att.edges || []);
          this.writeFloat(att.width || 0);
          this.writeFloat(att.height || 0);
        }
        break;
      case "skinnedmesh":
        this.writeString(att.path || null);
        this.writeFloatArray(att.uvs);
        this.writeShortArray(att.triangles);
        this.writeInt(att.vertices.length, true);
        for (var i = 0; i < att.vertices.length;) {
          var boneCount = att.vertices[i++];
          this.writeFloat(boneCount);
          for (var nn = i + boneCount * 4; i < nn; i += 4) {
            this.writeFloat(att.vertices[i]);
            this.writeFloat(att.vertices[i + 1]);
            this.writeFloat(att.vertices[i + 2]);
            this.writeFloat(att.vertices[i + 3]);
          }
        }
        this.writeColor(att.color || "ffffffff");
        this.writeInt(att.hull, true);
        if (nonessential) {
          this.writeIntArray(att.edges || []);
          this.writeFloat(att.width || 0);
          this.writeFloat(att.height || 0);
        }
        break;
    }
  },
  writeAnimation: function (animation, json) {
    // Slot timelines
    var slotNames = Object.keys(animation.slots || {});
    this.writeInt(slotNames.length, true);
    for (var i = 0; i < slotNames.length; i++) {
      var slotName = slotNames[i];
      for (var j = 0; j < json.slots.length; j++) {
        if (json.slots[j].name === slotName) {
          this.writeInt(j, true);
          break;
        }
      }
      var slotMap = animation.slots[slotName];
      var timelineTypes = [];
      if (slotMap.color) timelineTypes.push({ type: 4, data: slotMap.color });
      if (slotMap.attachment) timelineTypes.push({ type: 3, data: slotMap.attachment });
      this.writeInt(timelineTypes.length, true);
      for (var k = 0; k < timelineTypes.length; k++) {
        var tl = timelineTypes[k];
        this.writeByte(tl.type);
        this.writeInt(tl.data.length, true);
        for (var f = 0; f < tl.data.length; f++) {
          var frame = tl.data[f];
          this.writeFloat(frame.time);
          if (tl.type === 4) {
            this.writeColor(frame.color);
          } else {
            this.writeString(frame.name);
          }
          if (f < tl.data.length - 1) {
            this.writeCurve(frame.curve);
          }
        }
      }
    }

    // Bone timelines
    var boneNames = Object.keys(animation.bones || {});
    this.writeInt(boneNames.length, true);
    for (var i = 0; i < boneNames.length; i++) {
      var boneName = boneNames[i];
      for (var j = 0; j < json.bones.length; j++) {
        if (json.bones[j].name === boneName) {
          this.writeInt(j, true);
          break;
        }
      }
      var boneMap = animation.bones[boneName];
      var timelineTypes = [];
      if (boneMap.rotate) timelineTypes.push({ type: 1, data: boneMap.rotate });
      if (boneMap.translate) timelineTypes.push({ type: 2, data: boneMap.translate });
      if (boneMap.scale) timelineTypes.push({ type: 0, data: boneMap.scale });
      if (boneMap.flipX) timelineTypes.push({ type: 5, data: boneMap.flipX });
      if (boneMap.flipY) timelineTypes.push({ type: 6, data: boneMap.flipY });
      this.writeInt(timelineTypes.length, true);
      for (var k = 0; k < timelineTypes.length; k++) {
        var tl = timelineTypes[k];
        this.writeByte(tl.type);
        this.writeInt(tl.data.length, true);
        for (var f = 0; f < tl.data.length; f++) {
          var frame = tl.data[f];
          this.writeFloat(frame.time);
          if (tl.type === 1) {
            this.writeFloat(frame.angle);
          } else if (tl.type === 2 || tl.type === 0) {
            this.writeFloat(frame.x);
            this.writeFloat(frame.y);
          } else if (tl.type === 5 || tl.type === 6) {
            this.writeBoolean(tl.type === 5 ? frame.x : frame.y);
          }
          if (f < tl.data.length - 1) {
            this.writeCurve(frame.curve);
          }
        }
      }
    }

    // IK timelines
    var ikNames = Object.keys(animation.ik || {});
    this.writeInt(ikNames.length, true);
    for (var i = 0; i < ikNames.length; i++) {
      var ikName = ikNames[i];
      for (var j = 0; j < json.ik.length; j++) {
        if (json.ik[j].name === ikName) {
          this.writeInt(j, true);
          break;
        }
      }
      var timeline = animation.ik[ikName];
      this.writeInt(timeline.length, true);
      for (var f = 0; f < timeline.length; f++) {
        var frame = timeline[f];
        this.writeFloat(frame.time);
        this.writeFloat(frame.mix);
        this.writeBoolean(frame.bendPositive);
        if (f < timeline.length - 1) {
          this.writeCurve(frame.curve);
        }
      }
    }

    // FFD timelines
    var ffdSkinNames = Object.keys(animation.ffd || {});
    this.writeInt(ffdSkinNames.length, true);
    for (var i = 0; i < ffdSkinNames.length; i++) {
      var skinName = ffdSkinNames[i];
      var skinIndex = json.skinsName.indexOf(skinName);
      this.writeInt(skinIndex, true);
      var slotMap = animation.ffd[skinName];
      var slotNames2 = Object.keys(slotMap);
      this.writeInt(slotNames2.length, true);
      for (var j = 0; j < slotNames2.length; j++) {
        var slotName = slotNames2[j];
        for (var k = 0; k < json.slots.length; k++) {
          if (json.slots[k].name === slotName) {
            this.writeInt(k, true);
            break;
          }
        }
        var meshMap = slotMap[slotName];
        var meshNames = Object.keys(meshMap);
        this.writeInt(meshNames.length, true);
        for (var m = 0; m < meshNames.length; m++) {
          var meshName = meshNames[m];
          this.writeString(meshName);
          var timeline = meshMap[meshName];
          this.writeInt(timeline.length, true);
          for (var f = 0; f < timeline.length; f++) {
            var frame = timeline[f];
            this.writeFloat(frame.time);
            // For simplicity, write full vertices (end=0)
            this.writeInt(0, true);
            if (frame.vertices && frame.vertices.length > 0) {
              for (var v = 0; v < frame.vertices.length; v++) {
                this.writeFloat(frame.vertices[v]);
              }
            }
            if (f < timeline.length - 1) {
              this.writeCurve(frame.curve);
            }
          }
        }
      }
    }

    // Draw order timeline
    var drawOrders = animation.drawOrder || [];
    this.writeInt(drawOrders.length, true);
    for (var i = 0; i < drawOrders.length; i++) {
      var frame = drawOrders[i];
      this.writeInt(frame.offsets.length, true);
      for (var j = 0; j < frame.offsets.length; j++) {
        var offset = frame.offsets[j];
        for (var k = 0; k < json.slots.length; k++) {
          if (json.slots[k].name === offset.slot) {
            this.writeInt(k, true);
            break;
          }
        }
        this.writeInt(offset.offset, true);
      }
      this.writeFloat(frame.time);
    }

    // Event timeline
    var events = animation.events || [];
    this.writeInt(events.length, true);
    for (var i = 0; i < events.length; i++) {
      var frame = events[i];
      this.writeFloat(frame.time);
      for (var j = 0; j < json.eventsName.length; j++) {
        if (json.eventsName[j] === frame.name) {
          this.writeInt(j, true);
          break;
        }
      }
      this.writeInt(frame.int, true);
      this.writeFloat(frame.float);
      if (frame.string !== undefined && frame.string !== null) {
        this.writeBoolean(true);
        this.writeString(frame.string);
      } else {
        this.writeBoolean(false);
      }
    }
  },
  writeCurve: function (curve) {
    if (!curve) {
      this.writeByte(0);
      return;
    }
    if (curve === "stepped") {
      this.writeByte(1);
    } else if (Array.isArray(curve)) {
      this.writeByte(2);
      this.writeFloat(curve[0]);
      this.writeFloat(curve[1]);
      this.writeFloat(curve[2]);
      this.writeFloat(curve[3]);
    } else {
      this.writeByte(0);
    }
  },
  toBuffer: function () {
    return Buffer.from(this.data);
  }
};

// ========== Main Logic ==========
const INPUT_PATH = 'C:/Users/ADMIN/my-blog-v2/public/ak74m.skel';
const OUTPUT_PATH = 'C:/Users/ADMIN/my-blog-v2/public/ak74m_fixed.skel';

// Read the binary file
var buf = fs.readFileSync(INPUT_PATH);

// Parse with SkeletonBinary
var skel = new SkeletonBinary();
skel.data = new Uint8Array(buf);
skel.initJson();

console.log("Parsed skeleton:");
console.log("  Spine version:", skel.json.skeleton.spine);
console.log("  Bones count:", skel.json.bones.length);
console.log("  Animations:", Object.keys(skel.json.animations));

// Check if 'move' animation exists
if (!skel.json.animations.move) {
  console.error("ERROR: 'move' animation not found!");
  process.exit(1);
}

// Find leg bones
var legBoneNames = skel.json.bones
  .map(function (b) { return b.name; })
  .filter(function (name) {
    return /leg/i.test(name);
  });
console.log("Leg bones found:", legBoneNames);

// Modify 'move' animation: negate rotation angles for leg bones
var moveAnim = skel.json.animations.move;
var modifiedCount = 0;

for (var i = 0; i < legBoneNames.length; i++) {
  var boneName = legBoneNames[i];
  if (moveAnim.bones && moveAnim.bones[boneName] && moveAnim.bones[boneName].rotate) {
    var rotateTimeline = moveAnim.bones[boneName].rotate;
    console.log("  Modifying bone:", boneName, "- frames:", rotateTimeline.length);
    for (var f = 0; f < rotateTimeline.length; f++) {
      var oldAngle = rotateTimeline[f].angle;
      rotateTimeline[f].angle = -oldAngle;
      modifiedCount++;
      console.log("    Frame", f, ":", oldAngle, "->", rotateTimeline[f].angle);
    }
  }
}

console.log("Total modified angles:", modifiedCount);

// Write back to binary
var writer = new SkeletonBinaryWriter();
writer.writeSkeleton(skel.json);
var outBuf = writer.toBuffer();
fs.writeFileSync(OUTPUT_PATH, outBuf);

console.log("Fixed skeleton written to:", OUTPUT_PATH);
console.log("Original size:", buf.length, "bytes");
console.log("Fixed size:", outBuf.length, "bytes");
