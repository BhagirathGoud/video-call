
var socket;
var currentRoom = null;
function initialize() {


  var cfg = {'iceServers': [{'url': 'stun:23.21.150.121'}]};
  var con = { 'optional': [{'DtlsSrtpKeyAgreement': true}] };
  var peerConnnection1 = new RTCPeerConnection(cfg, con);
  var sdpConstraints = {
    optional: [],
    mandatory: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: true
    }
  };

  socket =  io('https://appathon-videocall.herokuapp.com');

  var roomId = location.search && location.search.split('?')[1];
  socket.on('connect', function() {
    socket.emit('joinRoom', roomId);
    console.log("Socket connection established");
  });

  socket.on('joinNewRoom', function(roomId) {
    console.log("Joined in a new Room", roomId);
    currentRoom = roomId;
    createAnswer();
  });

  socket.on('disconnect', function() {
    socket.emit('leaveRoom', currentRoom);
    console.log("Socket Disconnected");
  });

  function streamEvents() {
    function handleOnaddstream(e) {
      console.log('Got remote stream', e.stream);
      var el = document.getElementById('remoteVideo');
      attachMediaStream(el, e.stream);
    }

    function onsignalingstatechange (state) {
      console.info('signaling state change:', state);
    }

    function oniceconnectionstatechange (state) {
      console.info('ice connection state change:', state);
    }

    function onicegatheringstatechange (state) {
      console.info('ice gathering state change:', state);
    }

    peerConnnection1.onsignalingstatechange = onsignalingstatechange;
    peerConnnection1.oniceconnectionstatechange = oniceconnectionstatechange;
    peerConnnection1.onicegatheringstatechange = onicegatheringstatechange;

    peerConnnection1.onaddstream = handleOnaddstream;


  }


  function createAnswer() {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

    peerConnnection1.onicecandidate = function (e) {
      console.log('ICE candidate (pc2)', e);
      if (e.candidate == null) {
        sendLocalAnswer(JSON.stringify(peerConnnection1.localDescription));
      }
    };


    streamEvents();

    function errorHandler() {
      console.log("Rejected Answer");
    }

    function successHandler(localStream) {
      var localVideo = document.getElementById('localVideo');
      localVideo.src = window.URL.createObjectURL(localStream);
      peerConnnection1.addStream(localStream);
      // GEt Remote offer
      getRemoteOffer();
    }


    socket.on('recieveOffer', function(data) {
      console.log("Recieved data from Server", data);
      var offerDesc = new RTCSessionDescription(JSON.parse(data));
      handleOffer(offerDesc);
    });

    function getRemoteOffer() {
      console.log(currentRoom);
      socket.emit('getRemoteOffer', currentRoom);
    }

    function handleOffer(desc) {
      console.log("Handled offer from Remote Offer");
      peerConnnection1.setRemoteDescription(desc);
      peerConnnection1.createAnswer(function(answerDesc) {
        peerConnnection1.setLocalDescription(answerDesc);
        console.log("Local Desctiption is set");
      },
      function () { console.warn("Couldn't create offer"); },
      sdpConstraints);
    }



    function sendLocalAnswer(data) {
      console.log("Sending Answer to Socket", currentRoom);
      socket.emit('sendAnswer', {room: currentRoom, data: data});
    }




    var constraints = {
      video: true,
      audio: true
    };
    navigator.getUserMedia(constraints, successHandler, errorHandler);
  }


}

initialize();
