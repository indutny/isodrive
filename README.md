# Isodrive

Isometric game engine.

## Usage

Pick one script from `dist/` folder and create Isometric UI in following way:

```javascript
var ui = Isodrive.create({
  // Id or <canvas> element itself
  canvas: 'field',

  // Hashmap of sprites
  sprites: {
    // Property name - sprite's id,
    // Value - "url" # "x-offset" x "y-offset"
    block: '/images/block.png#32x16',
    player: '/images/player.png#32x12'
  },

  // Isometric cell properties
  cell: {
    width: 64,
    height: 32
  },

  // Zone configuration
  zone: {
    size: 8
  }
})
```

### Items

Engine consists of zones, which are basically cubes with width of 2 zone sizes
from options, and zones consists of items. Item is basically a sprite with
position and some class methods.

All items are instances of `Isodrive.Item` class. You can instaniate by calling:

```javascript
var item = new Isodrive.Item({
  // Item id, must be unique
  id: 123,

  // Item type, not used by engine itself
  type: 'some-user-specific-type',

  // Id of sprite to render
  sprite: 'sprite',

  // Position of item
  x: 0,
  y: 0,
  z: 0,

  // If true - players won't be able to pass through this item
  obstacle: true,

  // If true - gravitation applies to the item (NOT IMPLEMENTED YET!)
  gravitable: true
});
```

And you can add item to the map by calling `ui.add(item)`.

### Player item

Only one item is required to exists and to be initialized first - player item.
Map will follow player's movement and zones will be loaded if player will reach
their boundaries.

You should set map's player before inserting any other items: `ui.setPlayer(p)`.

### Item methods

#### Item#setSprite(id)

Change item's sprite

#### Item#animate({ props }, interval, callback)

A jquery-like animation method. Following props are available: `x`, `y`, `z`,
`dx`, `dy`, `dz`, `sprite`.

#### Item#move(dx, dy, dz)

Move item by relative offset

#### Item#setPosition(x, y, z)

Set item's absolute position.

#### Item#reset()

Reset all queued animations.

#### Item#remove()

Remove item from map.

#### Item#command(type, args, callback)

Abstraction, only one command is implemented by default - `remove`. Could be
overrided by subclasses. On execution emits `command` event.

### Isodrive methods

Isodrive map has it's own methods too.

#### Isodrive#setPlayer(item)

Sets map's player. Map will follow player if it'll change it's position.

#### Isodrive#hasObstacle(x, y, z)

Returns `Item` instance if there's obstacle on specified position. Also may
return `true` if specified position is out of loaded zones' ranges. Otherwise
returns `false`.

#### Isodrive#getItem(id)

Finds item by id.

#### Isodrive#player

Current map's player.

### Isodrive Events

Result of `Isodrive.create()` is an instance of [EventEmitter2][0]. And can emit
following events:

#### `load`

Emitted once ui is ready to be rendered. Happens once all sprites are loaded.

#### `zone:load`

Emitted once player enters new zone and engine wants you to fetch items from
server.

Zone configuration consists of following properties: `lx`, `ly`, `lz`, `rx`,
`ry`, `rz`. Which basically means inclusive left and exclusive right positions
of zone ranges.

#### LICENSE

Copyright (c) 2012, Fedor Indutny.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[0]: https://github.com/hij1nx/eventemitter2
