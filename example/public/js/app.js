!function() {
  var ui = Isodrive.create({
    canvas: 'field',
    sprites: {
      block: '/images/block.png#32x16',
      player: '/images/player.png#32x12'
    },
    cellWidth: 64,
    cellHeight: 32,
    zoneSize: 8
  });

  function createBlock(x, y, z) {
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

  ui.on('load', function() {
    console.log('UI loaded.');

    ui.on('zone:load', function(zone) {
      var middle = (zone.lz + zone.rz) >> 1;

      for (var x = zone.lx; x < zone.rx; x++) {
        for (var y = zone.ly; y < zone.ry; y++) {
          ui.add(createBlock(x, y, middle));
        }
      }

      for (var y = zone.ly; y < zone.ry; y++) {
        if (y % 2 == 0) {
          ui.add(createBlock(zone.lx, y, middle - 1));
        }
        ui.add(createBlock(zone.lx, y, middle - 2));
      }
    });

    ui.setPlayer(new Isodrive.Item({
      type: 'player',
      id: 0,
      sprite: 'player',
      x: 0,
      y: 0,
      z: -1
    }));

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
