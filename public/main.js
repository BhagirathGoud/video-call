
var socket;
var currentRoom = null;
function initialize() {


  var cfg = {'iceServers': [{'url': 'stun:23.21.150.121'}]};
  var con = { 'optional': [{'DtlsSrtpKeyAgreement': true}] };
  var peerConnnection = new RTCPeerConnection(cfg, con);
  var sdpConstraints = {
    optional: [],
    mandatory: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: true
    }
  };

  socket =  io();

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

    function oniceconnectionstatechange(event) {
      var state = peerConnnection.iceConnectionState;
      if (state == 'disconnected' || state == 'closed') {
        alert("Session Terminated");
      }
      console.info('ice connection state change:', state);
    }

    function onsignalingstatechange (state) {
      console.info('signaling state change:', state);
    }


    function onicegatheringstatechange (state) {
      console.info('ice gathering state change:', state);
    }

    peerConnnection.onsignalingstatechange = onsignalingstatechange;
    peerConnnection.oniceconnectionstatechange = oniceconnectionstatechange;
    peerConnnection.onicegatheringstatechange = onicegatheringstatechange;

    peerConnnection.onaddstream = handleOnaddstream;


  }


  function createAnswer() {

    peerConnnection.onnegotiationneeded = function() {
      socket.emit('negotiate', currentRoom);
    }

    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

    peerConnnection.onicecandidate = function (e) {
      console.log('ICE candidate (pc2)', e);
      if (e.candidate == null) {
        sendLocalAnswer(JSON.stringify(peerConnnection.localDescription));
      }
    };


    streamEvents();

    function errorHandler() {
      console.log("Rejected Answer");
    }

    function successHandler(localStream) {
      var localVideo = document.getElementById('localVideo');
      localVideo.src = window.URL.createObjectURL(localStream);
      peerConnnection.addStream(localStream);
      // GEt Remote offer
      getRemoteOffer();
    }


    socket.on('recieveOffer', function(data) {
      console.log("Recieved data from Server", data);
      var offerDesc;
      if (typeof data == "string") {
        offerDesc = new RTCSessionDescription(JSON.parse(data));
      } else {
        offerDesc = new RTCSessionDescription(data);
      }

      handleOffer(offerDesc);
    });

    function getRemoteOffer() {
      console.log(currentRoom);
      socket.emit('getRemoteOffer', currentRoom);
    }

    function handleOffer(desc) {
      console.log("Handled offer from Remote Offer");
      peerConnnection.setRemoteDescription(desc);
      peerConnnection.createAnswer(function(answerDesc) {
        peerConnnection.setLocalDescription(answerDesc);
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