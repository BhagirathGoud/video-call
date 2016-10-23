var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var Dropbox = require('dropbox');

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

var nodeData = {};

var roomSDP= {};

var maxClientsPerRoom = 2;

io.on('connection', function(socket){

  console.log('a user connected');

  socket.on('createNewRoom', function(data) {
    var room = data + '_' + Math.random().toString(36).substring(7);
    console.log("Create new room with id ", room);
    socket.join(room, function(err) {
      if(err) {
        console.log("Error in Creating New Room", room);
        return;
      }
      socket.emit('joinNewRoom', room);
    });
  });

  socket.on('joinRoom', function(roomId) {
    console.log(socket.rooms);
    console.log("Request to join room", roomId);

    var clients_in_room = io.sockets.adapter.rooms[roomId];
    if(clients_in_room && clients_in_room.length == maxClientsPerRoom){
      console.log("Can't join room as clients per room exceeded max limit", roomId);
      return;
    }

    socket.join(roomId, function(err) {
      if(err) {
        console.log("Error in Joining New Room", data);
        return;
      }
      socket.emit('joinNewRoom', roomId);
    });
  });

   socket.on('leaveRoom', function(roomId) {
     socket.leave(roomId);
   });

   socket.on('negotiate', function(roomId) {
     io.to(roomId).emit('negotiateSignal');
   });

  socket.on('sendOffer', function(meta) {
    console.log("Recieved Offer from Agent", meta);
    roomSDP[meta.room] = meta.data;
    io.to(meta.room).emit('recieveOffer', meta.data);
  });


  socket.on('getRemoteOffer', function(roomId) {
    console.log("Get Room Offer for ", roomId, roomSDP[roomId]);
    io.to(roomId).emit('recieveOffer', roomSDP[roomId]);
  });


  socket.on('sendAnswer', function(meta) {
    socket.to(meta.room).emit('recieveAnswer', meta.data);
  });


  socket.on('disconnect', function(){
    console.log('user disconnected');
  });


  socket.on('uploadDropboxData', function(data) {
    var dbx = new Dropbox({ accessToken: '8m941-K_2dAAAAAAAAAAEDr3J8hhf0ecYGEo8LD7RQaBiO7Bw63zRHIrqyN4M8E1' });
    var buf = new Buffer(data.blob, 'base64');
    var fileName = data.randomString + ".webm";

    console.log("in uploadDropboxData", buf);

    dbx.filesUpload({path: '/' + fileName, contents: buf}).then(function(response) {
        console.log("Uploaded file to Dropbox!!");

        dbx.sharingCreateSharedLink({path: response.path_display, short_url: true}).then(function(response){
          console.log("Sharable shortened link from Dropbox", response.url);
          socket.emit('uploadedFileUrl', response.url);
        }).catch(function(error) {
            console.log("Failed to fetch sharable shortened link from Dropbox");
        });
        
    }).catch(function(error) {
      console.log("Failed to upload file to Dropbox");
    });
  });

});

http.listen(process.env.PORT || 3000);
