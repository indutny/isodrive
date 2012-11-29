var http = require('http'),
    connect = require('connect');

var app = connect();

app.use(connect.static(__dirname + '/public'));

http.createServer(app).listen(8000, function() {
  var addr = this.address();
  console.log('Server is listening on %s:%d', addr.address, addr.port);
});
