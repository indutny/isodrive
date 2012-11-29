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
