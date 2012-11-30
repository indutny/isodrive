!function() {
  // Create UI
  var ui = Isodrive.create({
    // Id or <canvas> element itself
    canvas: 'field',

    // Hashmap of sprites
    sprites: {
      // Property name - sprite's id,
      // Value - "url" # "x-offset" x "y-offset"
      block: 'images/block.png#32x16',
      player: 'images/player.png#32x12'
    },

    // Isometric cell properties
    cell: {
      width: 64,
      height: 32
    },

    // Zone configuration
    zone: {
      size: 16
    },
    fps: true
  });

  // First of all, we must wait for all sprites to load before drawing anything
  ui.on('load', function() {
    console.log('UI loaded.');

    // Routine for simplfiied obstacle creation
    function createObstacle(x, y, z) {
      return new Isodrive.Item({
        type: 'block',
        id: Math.random(),
        sprite: 'block',
        x: x,
        y: y,
        z: z,
        obstacle: true
      });
    };

    // When player moves from one zone to another - `zone:load` event is emitted
    //
    // You should ask server for items in specified range, or just generate them
    // yourself as we do below
    ui.on('zone:load', function(zone) {
      console.log('Loading zone: ', zone);
      var middle = (zone.lz + zone.rz) >> 1;

      // Floor
      for (var x = zone.lx; x < zone.rx; x++) {
        for (var y = zone.ly; y < zone.ry; y++) {
          ui.add(createObstacle(x, y, middle));
        }
      }

      // Some walls with holes
      for (var y = zone.ly; y < zone.ry; y++) {
        if (y % 2 == 0) {
          ui.add(createObstacle(zone.lx, y, middle - 1));
          ui.add(createObstacle(zone.lx, y, middle - 2));
        }
        ui.add(createObstacle(zone.lx, y, middle - 3));
      }
    });

    // We need a player to center map and start loading zones
    ui.setPlayer(new Isodrive.Item({
      type: 'player',
      id: 0,
      sprite: 'player',
      x: 0,
      y: 0,
      z: -1
    }));

    // Basic movement example
    var moving = false;
    window.addEventListener('keydown', function onkeydown(e) {
      var code = e.keyCode;

      if (ui.player.moving || ui.player.falling) return;

      function move(options) {
        if (moving) return;
        moving = true;

        ui.player.animate(options, 200, function() {
          moving = false;
        });
      };

      if (code === 37) {
        move({ dx: -1 });
      } else if (code === 39) {
        move({ dx: 1 });
      } else if (code == 38) {
        move({ dy: -1 });
      } else if (code == 40) {
        move({ dy: 1 });
      } else {
        return;
      }

      e.preventDefault();
    }, true);
  });
}();
