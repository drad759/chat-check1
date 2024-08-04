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

let roomUserCounts = {};
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
  socket.on('join room', async ({ roomId, name }) => {
    socket.join(roomId);
    if (!roomUserCounts[roomId]) {
      roomUserCounts[roomId] = 0;
    }
    roomUserCounts[roomId]++;
    io.to(roomId).emit("update count", roomUserCounts[roomId]);
    console.log(name + ' has joined the room ' + roomId);
  


  
    try {
      // Retrieve previous messages from the database
      const messages = await Message.find({ roomId });
  
      // Send previous messages to the user
      socket.emit('previous messages', messages.map(msg => ({
        sender: msg.sender,
        text: msg.text
      })));
    } catch (error) {
      console.error('Error retrieving messages:', error);
      socket.emit('error', 'Failed to retrieve previous messages');
    }
  
    // io.of('/').in(roomId).clients((error, clients) => {
    //   if (error) {
    //     console.error('Error retrieving clients:', error);
    //     return;
    //   }
    //   const onlineCount = clients.length;
    //   console.log(onlineCount + " are in " + roomId);
    //   io.to(roomId).emit("update count", private);
    // });
  


    
    console.log(name + ' has joined the chat');
    socket.uname = name;  // Storing the user name
    socket.room = roomId;  // Storing the room id
    io.to(roomId).emit('join room', name); // Emitting to everyone in the room
  });

 


  socket.on('private message', async ({ roomId, msg }) => {
    // Save the message to the database
    const [sender, text] = msg.split(': ');
    const message = new Message({
      roomId,
      sender,
      text
    });
  
    await message.save();
  
    // Broadcast the message to all clients in the room
    socket.broadcast.to(roomId).emit('private message', msg);
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
    if (roomId) {
      if (roomUserCounts[roomId]) {
        roomUserCounts[roomId]--;
        if (roomUserCounts[roomId] <= 0) {
          delete roomUserCounts[roomId];
        } else {
          io.to(roomId).emit("update count", roomUserCounts[roomId]);
        }
      }
    }
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

