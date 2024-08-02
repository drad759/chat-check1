const express = require("express");
const session = require('express-session');
const http = require('http');
const socketio = require('socket.io');
const app = express();
const server = http.createServer(app);
const path = require('path');
const port = 3000;
const mongoose = require("mongoose");
const userRoute = require('./routes/user');
const User = require("./models/user");
const Message = require('./models/message');
const bodyParser = require('body-parser');
const io = socketio(server);
const { ExpressPeerServer } = require('peer');
const peer = ExpressPeerServer(server, {
  debug: true
});
const fs = require('fs');


mongoose.connect('mongodb+srv://dradsir:dradsir@cluster0.xdgmgyh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
.then(()=> console.log("MongoDb connected"));

app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

app.use('/peerjs', peer);
app.use(express.json());

app.use(session({
  secret:'i do not have any',
  resave: false,
  saveUninitialized: false,
}));

app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", async(req,res)=>{
    return res.render('home');
});



let onlineUsers = 0;
let connectedUsers = {};
//start connection
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

    socket.on('newUser', (id, room) => {
        socket.join(room);
        socket.to(room).broadcast.emit('userJoined', id);
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            socket.to(room).broadcast.emit('userDisconnect', id);
        });
    });











// Handle chat messages with email 
const rooms = {}; // { roomName: Set(userEmails) }

  function getRoomName(user1, user2) {
    const [first, second] = [user1, user2].sort(); // Ensure consistent room naming
    return `${first}-${second}`;
  }

  // Join a room
  socket.on('room', async (userEmail, contactEmail) => {
    const roomName = getRoomName(userEmail, contactEmail);

    if (!rooms[roomName]) {
        rooms[roomName] = new Set();
    }

    rooms[roomName].add(userEmail);
    socket.join(roomName);
    console.log(`User ${userEmail} joined room: ${roomName}`);

    // Fetch and send stored messages for the user
    const storedMessages = await Message.find({ roomName, contactEmail: userEmail });
    storedMessages.forEach(msg => {
        socket.emit('chat message', { userEmail: msg.userEmail, message: msg.message });
    });
});

// Handle sending messages
socket.on('chat message', async (data) => {
    const { userEmail, contactEmail, message } = data;
    const roomName = getRoomName(userEmail, contactEmail);

    if (rooms[roomName] && rooms[roomName].has(userEmail)) {
        // Store the message in the database
        await new Message({ userEmail, contactEmail, message, roomName }).save();

        // Broadcast the message to the room
        socket.to(roomName).emit('chat message', { userEmail, message });
    } else {
        console.log(`User ${userEmail} is not in room ${roomName}`);
    }
});

// Handle disconnection
socket.on('disconnect', () => {
    console.log('User disconnected');

    // Clean up room data
    for (const roomName in rooms) {
        rooms[roomName].delete(socket.request.userEmail);

        if (rooms[roomName].size === 0) {
            delete rooms[roomName];
        }
    }
});











  //for joining massage 
  socket.on('joining msg', (name) => {
      console.log(name + ' has joined the chat');
      onlineUsers++;//incrementing the online users count
      io.emit("update user count", onlineUsers); // used (io) to send to all sockets in that chatroom
      socket.name = name; //saving name in socket object to use it after in disconnect one
      io.emit('user joined', name); //sending everyone the joining info in chatroom(with name )
  });



  socket.on('chat message', (msg) => {
      socket.broadcast.emit('chat message', msg); //sending the massage to the every socket in chatroom except the one who initiated it(by using broadcast)
  });

//trying new file upload
  socket.on("file upload", function(file) {
    // Handle file upload
    socket.broadcast.emit("file upload", file);
});

socket.on('sendPhoto', (file) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  const maxSize = 4096 * 4096; //1mb

  // Validate file type and size
  if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type');
  }

  if (file.size > maxSize) {
      throw new Error('File too large');
  }

  const filePath = path.join(__dirname, 'uploads', file.name);

  fs.writeFile(filePath, file.data, (err) => {
      if (err) throw err;

      // Notify clients about the uploaded photo
      io.emit('receivePhoto', filePath);
  });
});


  //here we make our user to join the room by asking room id and name from prompt 
  socket.on('join room', ({ roomId, name }) => {
    socket.join(roomId); 
    io.of('/').in(roomId).clients((error, clients) => { //here we are storing all available clients infoin a specific room  in clients object
      if (error) throw error;
      const onlineCount = clients.length; // here we are taking the lenght of the clients object to know the user counts in a specific roomm 
      console.log(onlineCount + " are in " + roomId);
      io.to(roomId).emit("update count", onlineCount); //sending the number of connected users in a specific room 
    });
  
    console.log(name + 'as joined the chat');
    socket.uname = name;  //again storing the user name in socket object
    socket.room = roomId;  //storing the room id also in socket object
    io.to(roomId).emit('join room', name); // Emitting to everyone in the room
  });

 


socket.on('private message', ({ roomId, msg }) => {
    socket.broadcast.to(roomId).emit('private message', msg); // sending the massage to all the sockets in a specific room except the one who initiated it
});






// Emit updated user list to all clients
io.emit('update user list', Object.keys(connectedUsers));



//applying new disconnect 
socket.on('disconnect', () => {
  const name = socket.name;
  const roomId = socket.room;
  const uname = socket.uname;

  if (name) {
    console.log(name + 'user disconnected');
    onlineUsers--;
    io.emit("update user count", onlineUsers);
    io.emit('user left', name);
  }

  if (roomId) {
    console.log(uname + 'user disconnected from room '+ roomId);
    socket.to(roomId).emit('leave room', uname);
    io.of('/').in(roomId).clients((error, clients) => {
      if (error) throw error;
      const onlineCount = clients.length;
      socket.to(roomId).emit("update count", onlineCount);
    });
  }

  if (connectedUsers[name]) {
    delete connectedUsers[name];
    io.emit('update user list', Object.keys(connectedUsers));
  }
});


 // Helper function to update online users list
 function updateOnlineUsers() {
  io.emit('update online users', Object.keys(io.sockets.sockets).map(id => io.sockets.sockets[id].name));
}

// Helper function to update room user count
function updateRoomUserCount(roomId) {
  io.of('/').in(roomId).clients((error, clients) => {
    if (error) throw error;
    const onlineCount = clients.length;
    io.to(roomId).emit("update count", onlineCount);
  });
}


});


app.use("/user", userRoute);



server.listen(port,()=> console.log(`server started at: ${port}`))

