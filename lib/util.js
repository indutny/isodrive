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
