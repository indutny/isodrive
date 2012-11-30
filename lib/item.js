var util = require('util'),
    events = require('events'),
    sprites = require('sprites'),
    round = require('ui').round,
    EventEmitter = events.EventEmitter2;

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

  // For rendering
  this._renderTick = null;

  // Common fields used by models
  this.type = options.type || null;
  this.sprite = options.sprite || null;
  this.spriteData = null;
  this.spriteX = 0;
  this.spriteY = 0;
  this.spriteRight = 0;
  this.spriteBottom = 0;
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
  this.spriteData = this.sprite.elem;
  this.spriteWidth = this.sprite.width;
  this.spriteHeight = this.sprite.height;
  this.spriteX = this.projectionX - this.sprite.x;
  this.spriteY = this.projectionY - this.sprite.y;
  this.spriteRight = this.spriteX + this.spriteWidth;
  this.spriteBottom = this.spriteY + this.spriteHeight;
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
  this.spriteRight = this.spriteX + this.spriteWidth;
  this.spriteBottom = this.spriteY + this.spriteHeight;

  // Force rerender
  this.ui._changed = true;
  this.zone._changed = true;
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

Item.prototype.isInRect = function isInRect(lx, ly, rx, ry) {
  return this.spriteRight >= lx && this.spriteX <= rx &&
         this.spriteBottom >= ly && this.spriteY <= ry;
};

//
// Render callback
//
Item.prototype.render = function render(ctx) {
  if (!this.sprite || this._renderTick === this.ui._renderTick) return;
  this._renderTick = this.ui._renderTick;

  ctx.drawImage(this.spriteData,
                0,
                0,
                this.spriteWidth,
                this.spriteHeight,
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

  var x = this.startX + (this.x - this.startX) * percent,
      y = this.startY + (this.y - this.startY) * percent,
      z = this.startZ + (this.z - this.startZ) * percent;

  this.item.setPosition(x, y, z);
};

//
// End animation
//
ItemAnimation.prototype.end = function end() {
  this.item.setPosition(this.x, this.y, this.z);
  if (this.sprite) this.item.setSprite(this.sprite);
  if (this.callback) this.callback();
};
