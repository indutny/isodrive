var util = require('util'),
    events = require('events'),
    sprites = require('sprites'),
    EventEmitter = events.EventEmitter2;

// Export inheritance
exports.inherits = events.inherits;

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
  this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
  this.ctx.mozspritesmoothingEnabled = false;
  this.ctx.webkitspritesmoothingEnabled = false;
  this.ctx.msspritesmoothingEnabled = false;

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

  var centerZ = round(this.center.z);

  this.cx = round(this.width / 2 - this.centerProjection.x);
  this.cy = round(this.height / 2 - this.centerProjection.y);

  // Sort items in zones
  var zones = this.zones;
  for (var i = 0; i < zones.length; i++) {
    if (!zones[i].isVisible(centerZ)) continue;
    zones[i].sort();
  }

  this.ctx.save();
  this.ctx.translate(this.cx, this.cy);

  // Draw items in zones level-by-level
  for (var i = 5; i >= -5; i--) {
    // Apply shadow between deep zones
    if (i > 0) {
      this.ctx.fillRect(-this.cx, -this.cy, this.width, this.height);
    }

    for (var j = 0; j < zones.length; j++) {
      if (!zones[j].isVisible(centerZ)) continue;
      zones[j].render(this.ctx, i + centerZ);
    }
  }
  this.ctx.restore();
};

//
// Round value
//
function round(x) {
  return Math.round(x);
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

//
// Zone is a container of items
//
function Zone(x, y, z) {
  EventEmitter.call(this);

  this.items = [];
  this.x = x;
  this.y = y;
  this.z = z;

  this.lx = 0;
  this.ly = 0;
  this.lz = 0;
  this.rx = 0;
  this.ry = 0;
  this.rz = 0;

  this.map = {};

  this.ui = null;
};
util.inherits(Zone, EventEmitter);
exports.Zone = Zone;

//
// Link zone to UI and set it's bounds
Zone.prototype.init = function init(ui) {
  this.ui = ui;

  // Left-top bounds
  this.lx = this.x - this.ui.zoneSize;
  this.ly = this.y - this.ui.zoneSize;
  this.lz = this.z - this.ui.zoneSize;

  // Right-bottom bounds
  this.rx = this.x + this.ui.zoneSize;
  this.ry = this.y + this.ui.zoneSize;
  this.rz = this.z + this.ui.zoneSize;
};

//
// Check if zone contains item
//
Zone.prototype.contains = function contains(item) {
  return this.containsRaw(item.rx, item.ry, item.rz);
};

//
// Checks if zone contains point
//
Zone.prototype.containsRaw = function containsRaw(x, y, z) {
  return this.lx <= x && x < this.rx &&
         this.ly <= y && y < this.ry &&
         this.lz <= z && z < this.rz;
};

//
// Checks if zone is visible from specific depth
//
Zone.prototype.isVisible = function isVisible(z) {
  return this.lz <= z + 5 || z - 5 <= this.rz;
};

//
// Get item by id from zone
//
Zone.prototype.getItem = function getItem(id) {
  return this.map.hasOwnProperty(id) && this.map[id];
};

//
// Compare zones:
// < 0 - if a is below b
// == 0 - if a is on the same level as b
// > 0 - if a is above b
//
Zone.compare = function compare(a, b) {
  if (a.rz > b.rz) return -1;
  if (a.rz < b.rz) return 1;

  return a.rx + a.ry - b.rx - b.ry;
};

//
// Sort items in zone
//
Zone.prototype.sort = function sort() {
  var misses = [];
  for (var i = 0; i < this.items.length - 1; i++) {
    var current = this.items[i],
        next = this.items[i + 1];

    if (Item.compare(current, next) > 0) {
      misses.push(next);
      this.items.splice(i + 1, 1);
      i--;
    }
  }

  if (misses.length > 100) {
    this.items = this.items.concat(misses);
    this.items.sort(Item.compare);
  } else {
    for (var i = 0; i < misses.length; i++) {
      this.insert(misses[i]);
    }
  }
};

//
// Render zone and items in it
//
Zone.prototype.render = function render(ctx, z) {
  for (var i = 0; i < this.items.length; i++) {
    var item = this.items[i];

    // We're rendering layer-by-layer
    if (z !== item.rz) continue;

    var coverage = false;
    if (item !== this.ui.player && z <= this.ui.player.rz) {
      coverage = item.coverage(this.ui.player);

      if (coverage) {
        // Items covering player are transparent
        ctx.save();
        ctx.globalAlpha = coverage;
      }
    }

    item.render(ctx);
    item.postRender();

    if (coverage) ctx.restore();
  }
};

//
// Add item to zone and initialize it
//
Zone.prototype.add = function add(item) {
  if (this.map.hasOwnProperty(item.id)) return;

  item.init(this);
  this.insert(item);
  this.map[item.id] = item;
};

//
// Remove item from zone
//
Zone.prototype.remove = function remove(item) {
  if (!this.map.hasOwnProperty(item.id)) return;

  var index = this.items.indexOf(item);
  if (index !== -1) this.items.splice(index, 1);
  delete this.map[item.id];
};

//
// Insert item into zone
// (NOTE: use .add() to link item to zone before insertion)
//
Zone.prototype.insert = function insert(item) {
  // Fast case
  if (this.items.length === 0) {
    this.items.push(item);
    return;
  }

  // Binary-search + insertion
  var i = 0,
      j = this.items.length - 1,
      middle = 0;

  while (i <= j) {
    middle = (i + j) >> 1;
    var cmp = Item.compare(item, this.items[middle]);

    if (cmp == 0) {
      break;
    } else if (cmp < 0) {
      j = middle - 1;
    } else {
      i = middle + 1;
    }
  }

  if (cmp > 0) {
    middle++;
  }

  // Insert
  this.items.splice(middle, 0, item);
};

//
// Returns item at specific cell or false
//
Zone.prototype.getItemAtPos = function getItemAtPos(x, y, z) {
  // Fast case
  if (this.items.length === 0) return false;

  // Binary-search
  var cell = {
        _sortId: -1,
        rx: x,
        ry: y,
        rz: z
      },
      i = 0,
      j = this.items.length - 1,
      middle = 0;

  while (i <= j) {
    middle = (i + j) >> 1;
    var cmp = Item.compare(cell, this.items[middle]);

    if (cmp == 0) {
      break;
    } else if (cmp < 0) {
      j = middle - 1;
    } else {
      i = middle + 1;
    }
  }

  if (cmp > 0) {
    middle++;
  }

  // Start searching from middle
  for (var i = middle; i < this.items.length; i++) {
    var item = this.items[i],
        cmp = Item.compare(cell, item);

    if (cmp > 0) break;
    if (x === item.rx && y === item.ry && z === item.rz) return item;
  }

  return false;
};

//
// Generic UI Item
//
var itemId = 0;
function Item(options) {
  EventEmitter.call(this);

  this.id = options.id;
  this._sortId = itemId++;

  // Coordinates and rounded coordinates
  this.rx = this.x = options.x;
  this.ry = this.y = options.y;
  this.rz = this.z = options.z;

  // Cached projection coordinates
  this.projectionX = 0;
  this.projectionY = 0;

  // Animation queue
  this.animation = [];

  // References to containers
  this.zone = null;
  this.ui = null;

  // Common fields used by models
  this.type = options.type || null;
  this.sprite = options.sprite || null;
  this.spriteCanvas = null;
  this.spriteX = 0;
  this.spriteY = 0;
  this.spriteWidth = 0;
  this.spriteHeight = 0;
  this.obstacle = options.obstacle || false;
  this.gravitable = options.gravitable || false;

  // Movement state
  this.falling = false;
};
util.inherits(Item, EventEmitter);
exports.Item = Item;

//
// Compare items.
// Return > 0 if a is under b,
// < 0 if b is under a
// (NOTE: 0 is never returned for sort stability)
//
Item.compare = function compare(a, b) {
  if (a.rz > b.rz) return -1;
  if (a.rz < b.rz) return 1;

  // If items on the same line - sort them by id
  // (just for comparison stability)
  if (a.rx + a.ry === b.rx + b.ry) return a._sortId - b._sortId;

  return Item.lineCompare(a, b);
};

//
// Check if items are on the same line
//
Item.lineCompare = function lineCompare(a, b) {
  return a.rx + a.ry - b.rx - b.ry;
};

//
// Link item to zone and UI
//
Item.prototype.init = function init(zone) {
  this.zone = zone;
  this.ui = zone.ui;
  this.setPosition(this.x, this.y, this.z);

  if (this.sprite) this.setSprite(this.sprite);
};

Item.prototype.setSprite = function setSprite(sprite) {
  if (typeof sprite === 'string') {
    this.sprite = this.ui.sprites[sprite];
  } else {
    this.sprite = sprite;
  }
  this.spriteCanvas = this.sprite.canvas;
  this.spriteWidth = this.sprite.width;
  this.spriteHeight = this.sprite.height;
  this.spriteX = this.projectionX - this.sprite.x;
  this.spriteY = this.projectionY - this.sprite.y;
};

//
// Calculate coverage factor, used when making items above player transparent
//
Item.prototype.coverage = function coverage(item) {
  if (Item.lineCompare(this, item) <= 0) return false;

  var dx = this.projectionRX - item.projectionRX;
      dy = this.projectionRY - item.projectionRY,
      radius = dx * dx + dy * dy;

  if (radius > 9000) return 0;
  return (3000 + radius) / 18000;
};

//
// Set item's absolute position
//
Item.prototype.setPosition = function setPosition(x, y, z) {
  this.x = x;
  this.y = y;
  this.z = z;
  this.rx = round(x);
  this.ry = round(y);
  this.rz = round(z);

  // Move map if player has moved
  this.ui.handleMove(this);

  // Cache new projection point
  var p = this.ui.project(x, y, z);
  this.projectionX = p.x;
  this.projectionY = p.y;

  // And projection of rounded point
  var p = this.ui.project(this.rx, this.ry, this.rz);
  this.projectionRX = p.x;
  this.projectionRY = p.y;

  // Update sprite position
  this.spriteX = this.projectionX - this.sprite.x;
  this.spriteY = this.projectionY - this.sprite.y;

  // Force rerender
  this.ui._changed = true;
};
Item.prototype._setPosition = Item.prototype.setPosition;

//
// Move item by delta
//
Item.prototype.move = function move(dx, dy, dz) {
  this.setPosition(this.x + dx, this.y + dy, this.z + dz);
};
Item.prototype._move = Item.prototype.move;

//
// Animate item
//
Item.prototype.animate = function animate(props, interval, callback) {
  var self = this;

  // Force rerender
  this.ui._changed = true;

  // Queue animation
  this.animation.push(new ItemAnimation(this, props, interval, callback));
};

//
// Reset animation
//
Item.prototype.reset = function reset() {
  if (this.animation.length === 0) return;

  for (var i = 0; i < this.animation.length; i++) {
    var a = this.animation[i];
    a.init();
    a.end();
  }
  this.animation = [];
};

//
// Render callback
//
Item.prototype.render = function render(ctx) {
  if (!this.sprite) return;

  ctx.drawImage(this.spriteCanvas,
                this.spriteX,
                this.spriteY,
                this.spriteWidth,
                this.spriteHeight);
};

//
// Post-render callback
//
Item.prototype.postRender = function postRender() {
  // Apply animation
  if (this.animation.length === 0) return;

  while (this.animation.length !== 0) {
    var first = this.animation[0];

    // Set start positions
    first.init();

    if (first.start + first.interval <= Date.now()) {
      this.animation.shift();
      first.end();
      this.ui._changed = true;
      continue;
    }

    first.run();
    this.ui._changed = true;
    break;
  }
};

//
// Run external command
//
Item.prototype.command = function command(cmd, options, callback) {
  this.emit('command', cmd, options);

  if (cmd === 'remove') {
    this.remove();
    if (callback) callback();
    return true;
  }

  return false;
};

//
// Remove item from zone
//
Item.prototype.remove = function remove() {
  this.zone.remove(this);
};

//
// Apply gravitation
//
Item.prototype.gravitation = function gravitation(callback) {
  if (this.falling) return;

  var grnd,
      x = this.rx,
      y = this.ry,
      z = this.rz;

  // Find closest ground
  for (var i = 1; !(grnd = this.ui.hasObstacle(x, y, z + i)); i++) {
  }

  // If object is already on the ground - invoke callback
  if (grnd.rz === z + 1) {
    if (callback) callback();
    return;
  }

  // Animate fall
  var self = this;
  this.falling = true;
  var dz = grnd.rz - z - 1;
  this.animate({ dz: dz }, dz * 200, function() {
    self.falling = false;

    // Apply gravitation again (useful if we're falling through multiple zones
    self.gravitation(callback);
  });
};

//
// Animation configuration
//
function ItemAnimation(item, props, interval, callback) {
  this.item = item;

  this.props = props;
  this.sprite = props.sprite;
  this.startX = null;
  this.startY = null;
  this.startZ = null;
  this.x = null;
  this.y = null;
  this.z = null;

  this.start = null;
  this.interval = interval || 1;

  this.callback = callback;
};

//
// Set start coordinates and time interval
//
ItemAnimation.prototype.init = function init() {
  if (this.start !== null) return;

  this.start = Date.now();
  this.x = this.startX = this.item.x;
  this.y = this.startY = this.item.y;
  this.z = this.startZ = this.item.z;

  var names = [ 'x', 'y', 'z' ];

  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    if (this.props.hasOwnProperty(name)) {
      this[name] = this.props[name];
    } else if (this.props.hasOwnProperty('d' + name)) {
      this[name] += this.props['d' + name];
    }
  }

  // Do not move into obstacle
  if (this.item.ui.hasObstacle(this.x, this.y, this.z)) {
    this.x = this.startX;
    this.y = this.startY;
    this.z = this.startZ;
    this.interval = 1;
  }
};

//
// Run animation
//
ItemAnimation.prototype.run = function run() {
  var percent = (Date.now() - this.start) / this.interval;

  this.item.setPosition(this.startX + (this.x - this.startX) * percent,
                        this.startY + (this.y - this.startY) * percent,
                        this.startZ + (this.z - this.startZ) * percent);
};

//
// End animation
//
ItemAnimation.prototype.end = function end() {
  this.item.setPosition(this.x, this.y, this.z);
  if (this.sprite) this.item.setSprite(this.sprite);
  if (this.callback) this.callback();
};
