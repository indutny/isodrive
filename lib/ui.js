var util = require('util'),
    events = require('events'),
    sprites = require('sprites'),
    EventEmitter = events.EventEmitter2;

// Export inheritance
exports.inherits = events.inherits;

//
// Round value
//
function round(x) {
  return Math.round(x);
};
exports.round = round;

// Load Zone and Item
var Item = exports.Item = require('item').Item;
var Zone = exports.Zone = require('zone').Zone;

//
// Main component, does all coordination between children
//
function UI(options) {
  EventEmitter.call(this);

  this.options = options;

  this.canvas = typeof options.canvas === 'string' ?
      document.getElementById(options.canvas) : options.canvas;
  this.sprites = {};
  this.spriteMap = options.sprites;
  this.width = 1;
  this.height = 1;

  this.ctx = this.canvas.getContext('2d');

  this.cellWidth = options.cell.width;
  this.cellHeight = options.cell.height;
  this.zoneSize = options.zone.size;

  // Current center
  this.cx = 0;
  this.cy = 0;

  // 27 zones, one for each side and one for center
  this.zones = [];

  this.center = { x: 0, y: 0, z: 0 };
  this.centerProjection = this.project(this.center);
  this.player = null;
  this._changed = false;
  this._renderTick = 0;

  if (this.options.fps) {
    this.fps = 0;
  }

  this.init();
};
util.inherits(UI, EventEmitter);
exports.UI = UI;
exports.create = function create(options) {
  return new UI(options);
};

//
// Setup event listeners and render loop
//
UI.prototype.init = function init() {
  var self = this;

  // Display fps
  if (this.options.fps) {
    setInterval(function() {
      location.hash = self.fps;
      self.fps = 0;
    }, 1000);
  }

  // Configure canvas
  this.ctx.mozspritesmoothingEnabled = false;
  this.ctx.webkitspritesmoothingEnabled = false;
  this.ctx.msspritesmoothingEnabled = false;

  // Resize UI on window resize
  function onresize() {
    var width = window.innerWidth,
        height = window.innerHeight;

    if (typeof self.options.maxWidth === 'number') {
      width = Math.min(width, self.options.maxWidth);
    }
    if (typeof self.options.maxHeight === 'number') {
      height = Math.min(height, self.options.maxHeight);
    }
    self.resize(width, height);
  }
  window.addEventListener('resize', onresize);
  onresize();

  // Draw animation
  var onframe = window.mozRequestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                window.RequestAnimationFrame;

  // Load sprites
  sprites.load(this.spriteMap, function(map) {
    self.sprites = map;
    self.emit('load');

    onframe(function render() {
      self.render();
      onframe(render);
    });
  });
};

//
// Add item to some zone (if it exists)
//
UI.prototype.add = function add(item) {
  var zone = this.getZone(item.x, item.y, item.z);
  if (!zone) return;

  zone.add(item);
};

//
// Resize canvas
//
UI.prototype.resize = function resize(width, height) {
  this._changed = true;
  this.width = this.canvas.width = width;
  this.height = this.canvas.height = height;

  // Center canvas
  if (this.options.center !== false) {
    this.canvas.style.marginLeft = (window.innerWidth - width) / 2 + 'px';
    this.canvas.style.marginTop = (window.innerHeight - height) / 2 + 'px';
  }
};

//
// Get projection coordinates
//
UI.prototype.project = function project(x, y, z) {
  return {
    x: Math.round((x - y) * this.cellWidth / 2),
    y: Math.round((1.23 * z + (x + y) / 2) * this.cellHeight),
  };
};

//
// Global render loop
//
UI.prototype.render = function render() {
  if (!this._changed) return;
  this._changed = false;
  this.ctx.clearRect(0, 0, this.width, this.height);

  if (this.options.fps) this.fps++;

  var centerZ = round(this.center.z);

  this.cx = round(this.width / 2 - this.centerProjection.x);
  this.cy = round(this.height / 2 - this.centerProjection.y);

  // Sort items in zones
  var zones = this.zones;
  for (var i = 0; i < zones.length; i++) {
    if (!zones[i].isVisible(centerZ)) continue;
    zones[i]._last = 0;
    zones[i].sort();
  }

  this._renderTick = ~this._renderTick;

  this.ctx.save();
  this.ctx.translate(this.cx, this.cy);

  // Draw items in zones level-by-level
  for (var i = 5; i >= -5; i--) {
    // Apply shadow between deep zones
    if (i > 0) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
      this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
    }

    for (var j = 0; j < zones.length; j++) {
      if (!zones[j].isVisible(centerZ)) continue;
      zones[j].render(this.ctx, i + centerZ);
    }
  }

  // Apply animations and other stuff
  for (var j = 0; j < zones.length; j++) {
    zones[j].postRender();
  }

  this.ctx.restore();
};

//
// Get item by id from all zones
//
UI.prototype.getItem = function getItem(id) {
  for (var i = 0; i < this.zones.length; i++) {
    var item = this.zones[i].getItem(id);
    if (item) return item;
  }
};

//
// Get zone by coordinates
//
UI.prototype.getZone = function getZone(x, y, z) {
  for (var i = 0; i < this.zones.length; i++) {
    if (this.zones[i].containsRaw(x, y, z)) {
      return this.zones[i];
    }
  }

  return false;
};

//
// Add zone and link it to UI
//
UI.prototype.addZone = function addZone(zone) {
  zone.init(this);
  this.zones.push(zone);
};

//
// Set UI's center and create/load zones
//
UI.prototype.setCenter = function setCenter(x, y, z, zoneChanged) {
  this.center = { x: x, y: y, z: z};
  this.centerProjection = this.project(x, y, z);

  if (this.zones.length !== 0 && !zoneChanged) return;

  var configs = [
    [-1, -1, -1], [0, -1, -1], [1, -1, -1],
    [-1, 0, -1],  [0, 0, -1],  [1, 0, -1],
    [-1, 1, -1],  [0, 1, -1],  [1, 1, -1],
    [-1, -1, 0],  [0, -1, 0],  [1, -1, 0],
    [-1, 0, 0],   [0, 0, 0],   [1, 0, 0],
    [-1, 1, 0],   [0, 1, 0],   [1, 1, 0],
    [-1, -1, 1],  [0, -1, 1],  [1, -1, 1],
    [-1, 0, 1],   [0, 0, 1],   [1, 0, 1],
    [-1, 1, 1],   [0, 1, 1],   [1, 1, 1]
  ];

  x = Math.round(x / this.zoneSize) * this.zoneSize;
  y = Math.round(y / this.zoneSize) * this.zoneSize;
  z = Math.round(z / this.zoneSize) * this.zoneSize;

  if (this.zones.length === 0) {
    // Create inital zones

    for (var i = 0; i < configs.length; i++) {
      var conf = configs[i];
      this.addZone(new Zone(x + conf[0] * 2 * this.zoneSize,
                            y + conf[1] * 2 * this.zoneSize,
                            z + conf[2] * 2 * this.zoneSize));
    }

    // load new ones
    for (var i = 0; i < this.zones.length; i++) {
      var zone = this.zones[i];
      this.emit('zone:load', {
        lx: zone.lx,
        ly: zone.ly,
        lz: zone.lz,
        rx: zone.rx,
        ry: zone.ry,
        rz: zone.rz
      });
    }
  } else {
    var cx = this.player.zone.x,
        cy = this.player.zone.y,
        cz = this.player.zone.z;

    var valid = [],
        queue = [];

    // Create new zones
    for (var i = 0; i < configs.length; i++) {
      var zone,
          conf = configs[i],
          zx = cx + conf[0] * (this.zoneSize + 1),
          zy = cy + conf[1] * (this.zoneSize + 1),
          zz = cz + conf[2] * (this.zoneSize + 1),
          newx = cx + conf[0] * 2 * this.zoneSize,
          newy = cy + conf[1] * 2 * this.zoneSize,
          newz = cz + conf[2] * 2 * this.zoneSize;

      // Zone already exists
      if (!(zone = this.getZone(zx, zy, zz))) {
        zone = new Zone(newx, newy, newz);
        queue.push(zone);
        this.addZone(zone);
      }
      valid.push(zone);
    }

    this.zones = valid;

    // load new ones
    for (var i = 0; i < queue.length; i++) {
      var zone = queue[i];
      this.emit('zone:load', {
        lx: zone.lx,
        ly: zone.ly,
        lz: zone.lz,
        rx: zone.rx,
        ry: zone.ry,
        rz: zone.rz
      });
    }
  }

  this.zones.sort(Zone.compare);
};

//
// Make item a player, UI will be centered using item's coordinates
//
UI.prototype.setPlayer = function setPlayer(item) {
  this.player = item;

  // Reset zones
  this.zones = [];
  this.setCenter(item.x, item.y, item.z);
  this.add(item);
};

//
// Callback invoked on item movement
//
UI.prototype.handleMove = function handleMove(item) {
  var zoneChanged = false;

  // Move item to another zone (or remove it) if needed
  if (!item.zone.contains(item)) {
    zoneChanged = true;

    // Remove from it's current zone
    item.remove();

    // Readd to new zone (if any contains it)
    for (var i = 0; i < this.zones.length; i++) {
      if (this.zones[i].contains(item)) {
        this.zones[i].add(item);
        break;
      }
    }
  }

  // Set center and allocate new zones (if needed)
  if (this.player === item) {
    this.setCenter(this.player.x, this.player.y, this.player.z, zoneChanged);
  }
};

//
// Return true if some zone contains obstacle at given cell
//
UI.prototype.hasObstacle = function hasObstacle(x, y, z) {
  // First find zone containing point
  var zone = this.getZone(x, y, z);

  // Moving into space without zone is impossible
  if (!zone) return true;

  var item = zone.getItemAtPos(x, y,z);
  if (!item) return false;

  return item.obstacle ? item : false;
};
