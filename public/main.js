var socket;
var currentRoom = null;
var roomID = location.search && location.search.split('?')[1];

function initialize() {
  var cfg = {
    'iceServers': [{
      'url': 'stun:23.21.150.121'
    }]
  };
  var con = {
    'optional': [{
      'DtlsSrtpKeyAgreement': true,
    }]
  };
  var peerConnnection = new RTCPeerConnection(cfg, con);
  var dataChannel;
  var sdpConstraints = {
    optional: [],
    mandatory: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: true
    }
  };

  socket = io();
  disableChatArea();

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

  $("#sendBtn").on('click', function() {
    sendMessage();
  });


  function enableChatArea() {
    $('#chatBox').prop('disabled', false);
    $("#sendBtn").prop('disabled', false);
    $("#chatInput").prop('disabled', false);
  }

  function disableChatArea() {
    $('#chatBox').prop('disabled', true);
    $("#sendBtn").prop('disabled', true);
    $("#chatInput").prop('disabled', true);
  }

  function displayMessage(data) {
    var currentVal = $('#chatBox').val();
    var msg = "\n Agent: " + data;
    $('#chatList').append('<li class="left-msg">' + data + '</li>');
    $('#chatBox').val(currentVal + msg);
  };

  function appendMyMessage(text) {
    var currentVal = $('#chatBox').val();
    var msg = "ME: " + text;
    $('#chatList').append('<li class="right-msg">' + text + '</li>');
    $('#chatBox').val(currentVal + msg);
  }

  function sendMessage() {
    var text = $("#chatInput").val();
    console.log("Sending Data to Agent", text);
    appendMyMessage(text);
    dataChannel.send(text);
    $("#chatInput").val('');
  }

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

    function onsignalingstatechange(state) {
      console.info('signaling state change:', state);
    }


    function onicegatheringstatechange(state) {
      console.info('ice gathering state change:', state);
    }

    function handleMessage() {
      console.log('Received message: ' + event.data);
      displayMessage(event.data);
    }



    function handleReceiveChannelStateChange() {
      if (dataChannel) {
        var state = dataChannel.readyState;
        if (state === 'open') {
          enableChatArea();
        } else if (state === 'closed') {
          disableChatArea();
        }
      }
    }



    function gotReceiveChannel(event) {
      console.log('Received Data Channel Callback');
      enableChatArea();
      dataChannel = event.channel;
      dataChannel.onmessage = handleMessage;
      dataChannel.onopen = handleReceiveChannelStateChange;
      dataChannel.onclose = handleReceiveChannelStateChange;
    }



    peerConnnection.onsignalingstatechange = onsignalingstatechange;
    peerConnnection.oniceconnectionstatechange = oniceconnectionstatechange;
    peerConnnection.onicegatheringstatechange = onicegatheringstatechange;

    peerConnnection.onaddstream = handleOnaddstream;

    peerConnnection.ondatachannel = gotReceiveChannel;


  }


  function createAnswer() {

    peerConnnection.onnegotiationneeded = function() {
      socket.emit('negotiate', currentRoom);
    }

    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

    peerConnnection.onicecandidate = function(e) {
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
        function() {
          console.warn("Couldn't create offer");
        },
        sdpConstraints);
    }

    function sendLocalAnswer(data) {
      console.log("Sending Answer to Socket", currentRoom);
      socket.emit('sendAnswer', {
        room: currentRoom,
        data: data
      });
    }

    var constraints = {
      video: true,
      audio: true
    };
    navigator.getUserMedia(constraints, successHandler, errorHandler);
  }
}

if (roomID) {
  initialize();
} else {
  $(".layout")
    .addClass('no-room')
    .html("<h3>ERROR: You are not connected to any room.</h3>")
    .append("<form action='' method='GET'><input type='text' name='room_id' placeholder='Enter a room id' class='room-control' /><input type='submit' value='Submit' class='room-btn' /></form>");
}
