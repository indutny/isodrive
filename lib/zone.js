var util = require('util'),
    events = require('events'),
    sprites = require('sprites'),
    round = require('ui').round,
    EventEmitter = events.EventEmitter2,
    Item = require('ui').Item;

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

  // Last render index
  this._last = 0;
  this._changed = false;

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
  return this.lz <= z + 5 && z - 5 <= this.rz;
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
  if (!this._changed) return;
  this._changed = false;

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
  var last = this._last;
  for (var i = last; i < this.items.length; i++) {
    var item = this.items[i];

    // We're rendering layer-by-layer
    if (item.rz < z) break;
    if (z !== item.rz) continue;

    last = i;

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

    if (coverage) ctx.restore();
  }

  this._last = last;
};

//
// Invoke postRender on all items
//
Zone.prototype.postRender = function postRender() {
  for (var i = 0; i < this.items.length; i++) {
    var item = this.items[i];
    item.postRender();
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
    if (round(x) === item.rx && round(y) === item.ry && round(z) === item.rz) {
      return item;
    }
  }

  return false;
};
