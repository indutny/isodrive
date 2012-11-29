(function(){var global = this;function debug(){return debug};function require(p, parent){ var path = require.resolve(p) , mod = require.modules[path]; if (!mod) throw new Error('failed to require "' + p + '" from ' + parent); if (!mod.exports) { mod.exports = {}; mod.call(mod.exports, mod, mod.exports, require.relative(path), global); } return mod.exports;}require.modules = {};require.resolve = function(path){ var orig = path , reg = path + '.js' , index = path + '/index.js'; return require.modules[reg] && reg || require.modules[index] && index || orig;};require.register = function(path, fn){ require.modules[path] = fn;};require.relative = function(parent) { return function(p){ if ('debug' == p) return debug; if ('.' != p.charAt(0)) return require(p); var path = parent.split('/') , segs = p.split('/'); path.pop(); for (var i = 0; i < segs.length; i++) { var seg = segs[i]; if ('..' == seg) path.pop(); else if ('.' != seg) path.push(seg); } return require(path.join('/'), parent); };};require.register("events.js", function(module, exports, require, global){
!function() {
  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {

      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }
    
    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }
        
        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
    
    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;
            
            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              console.trace();
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  };

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    };

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {
    
    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {
      
      if (!this._all && 
        !this._events.error && 
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || this._all;
    }
    else {
      return this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {
    
    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;
        
        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          console.trace();
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if(!this._all) {
      this._all = [];
    }

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          return this;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1)
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
    define(function() {
      return EventEmitter;
    });
  } else {
    exports.EventEmitter2 = EventEmitter; 
  }
}();

});require.register("isodrive.js", function(module, exports, require, global){
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

});require.register("sprites.js", function(module, exports, require, global){
exports.load = function load(urls, callback) {
  var spriteIds = Object.keys(urls),
      sprites = {};

  var left = spriteIds.length;

  // Run callback in next tick
  if (left === 0) return setTimeout(callback, 0);

  spriteIds.forEach(function(id) {
    var img = new Image(),
        canvas = document.createElement('canvas'),
        match = urls[id].match(/^(.*)#(\d+)x(\d+)$/),
        once = false;

    sprites[id] = {
      width: 0,
      height: 0,
      x: parseInt(match[2], 10),
      y: parseInt(match[3], 10),
      elem: img,
      canvas: canvas
    };

    img.onload = function onload() {
      if (once) return;
      once = true;

      sprites[id].width = img.width;
      sprites[id].height = img.height;
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);

      if (--left === 0) return onSprites();
    };
    img.src = match[1];
  });

  var loaded = false;
  function onSprites() {
    if (loaded) return;
    loaded = true;

    setTimeout(callback.bind(null, sprites), 0);
  };
};

});require.register("util.js", function(module, exports, require, global){
function inherits(a, b) {
  a.super_ = b;
  a.prototype = Object.create(b.prototype, {
    constructor: {
      value: a,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};
exports.inherits = inherits;

});var exp = require('isodrive');if ("undefined" != typeof module) module.exports = exp;else Isodrive = exp;
})();
