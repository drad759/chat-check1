const express = require("express");
const session = require('express-session');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
const mongoose = require("mongoose");
const multer = require('multer');
const multerMemoryStorage = multer.memoryStorage();
const upload = multer({ storage: multerMemoryStorage });
const { GridFSBucket } = require('mongodb');
const stream = require('stream');
const userRoute = require('./routes/user');
const User = require("./models/user");
const Message = require('./models/message');

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const port = 3000;



let bucket;

async function initialize() {
  try {
    await mongoose.connect('mongodb+srv://dradsir:dradsir@cluster0.xdgmgyh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0' );
    console.log("MongoDB connected");

    bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
    });

    const upload = multer({ storage: multer.memoryStorage() }); // For in-memory storage

    app.set("view engine", "ejs");
    app.set("views", path.resolve("./views"));

    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(session({
      secret: 'your-session-secret',
      resave: false,
      saveUninitialized: false
    }));

    app.use("/user", userRoute);

    app.get("/", (req, res) => {
      res.render('home');
    });

    app.get("/upload-pic", (req, res) => {
      const userEmail = req.query.email; // Extract email from query parameter
      if (!userEmail) {
        return res.status(400).json({ error: 'Email parameter is missing' });
      }
    
      // Optionally, store the email in the session for future requests
      req.session.userEmail = userEmail;
    
      console.log('User email:',  req.session.userEmail); // For debugging purposes
    
      res.render('upload-pic');
    });
    app.post('/upload', upload.single('image'), async (req, res) => {
      console.log('File data is here:', req.file);
      console.log('Form data:', req.body); // Log form data to ensure email is included

        
      console.log(req.session.userEmail+" use wmaisfvvsnfvbsfnvb");
    
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
       const userEmail = req.session.userEmail; // Retrieve user email from form data
      if (!userEmail) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      console.log("reached here");
      
      try {
        const uploadStream = bucket.openUploadStream(req.file.originalname, {
          metadata: { email: userEmail }
        });
        
        const readableStream = new stream.PassThrough();
        readableStream.end(req.file.buffer);
        
        readableStream.pipe(uploadStream);
        
        uploadStream.on('finish', () => {
          console.log('File uploaded successfully');
          res.json({ fileId: uploadStream.id, filename: req.file.originalname });
        });
        
        uploadStream.on('error', (err) => {
          console.error('Upload error:', err);
          res.status(500).json({ error: err.message });
        });
      } catch (err) {
        console.error('Error during file upload:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    
    app.get('/images', async (req, res) => {
      try {
        const userEmail = req.session.userEmail; // Retrieve user email from session
        if (!userEmail) {
          return res.status(403).json({ error: 'Unauthorized' });
        }
        const files = await bucket.find({ 'metadata.email': userEmail }).toArray();
        const imageFiles = files.map(file => ({
          filename: file.filename,
          id: file._id
        }));
        res.json(imageFiles);
      } catch (err) {
        console.error('Error fetching images:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/images/:filename', async (req, res) => {
      const filename = req.params.filename;
      const userEmail = req.session.userEmail; // Retrieve user email from session
      if (!userEmail) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      try {
        const files = await bucket.find({ filename: filename, 'metadata.email': userEmail }).toArray();
        if (files.length === 0) {
          return res.status(404).json({ error: 'File not found' });
        }
        
        const downloadStream = bucket.openDownloadStreamByName(filename);

        downloadStream.on('data', (chunk) => {
          res.write(chunk);
        });

        downloadStream.on('end', () => {
          res.end();
        });

        downloadStream.on('error', (err) => {
          console.error('Download error:', err);
          res.status(404).json({ error: 'File not found' });
        });
      } catch (err) {
        console.error('Error fetching file:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // app.get('/images/id/:id', async (req, res) => {
    //   const id = new mongoose.Types.ObjectId(req.params.id);
    //   const userEmail = req.session.userEmail; // Retrieve user email from session

      

    //   try {
    //     const files = await bucket.find({ _id: id, }).toArray();
    //     if (files.length === 0) {
    //       return res.status(404).json({ error: 'File not found' });
    //     }

    //     const downloadStream = bucket.openDownloadStream(id);

    //     downloadStream.on('data', (chunk) => {
    //       res.write(chunk);
    //     });

    //     downloadStream.on('end', () => {
    //       res.end();
    //     });

    //     downloadStream.on('error', (err) => {
    //       console.error('Download error:', err);
    //       res.status(404).json({ error: 'File not found' });
    //     });
       
    //   } catch (err) {
    //     console.error('Error fetching file:', err);
    //     res.status(500).json({ error: 'Internal server error' });
    //   }
    // });


    //setting up fetching system from email
    // Route to fetch images uploaded by a specific email
    app.get('/images/email/:email', async (req, res) => {
      const userEmail = req.params.email;
    
      if (!userEmail) {
        return res.status(400).send('Email parameter is missing');
      }
    
      try {
        // Find files associated with the given email
        const files = await bucket.find({ 'metadata.email': userEmail }).toArray();
        
        if (files.length === 0) {
          return res.status(404).json({ error: 'No files found for this email' });
        }
    
        // Assuming you want to serve the first file found
        const file = files[0];
    
        // Validate that _id is an ObjectId
        if (!mongoose.Types.ObjectId.isValid(file._id)) {
          return res.status(400).json({ error: 'Invalid file ID' });
        }
    
        // Open a download stream for the file
        else{
          const downloadStream = bucket.openDownloadStream(file._id);
    
        // Set appropriate headers
        res.setHeader('Content-Type', file.metadata.contentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    
        // Pipe the download stream to the response
        downloadStream.pipe(res);
    
        // Handle download stream errors
        downloadStream.on('error', (err) => {
          console.error('Download error:', err);
          res.status(500).json({ error: 'Internal server error' });
        });
        }
    
      } catch (err) {
        console.error('Error fetching file:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
  


    app.delete('/images/id/:id', async (req, res) => {
      const id = new mongoose.Types.ObjectId(req.params.id);
      const userEmail = req.session.userEmail; // Retrieve user email from session

      if (!userEmail) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      try {
        const files = await bucket.find({ _id: id, 'metadata.email': userEmail }).toArray();
        if (files.length === 0) {
          return res.status(404).json({ error: 'File not found' });
        }

        await bucket.delete(id);
        res.status(200).json({ message: 'File deleted successfully' });
      } catch (err) {
        console.error('Error deleting file:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });



















    let onlineUsers = 0;
    let connectedUsers = {};
    let roomUserCounts = {};

    // Set up socket.io
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

      socket.on('joining msg', (name) => {
        console.log(name + ' has joined the chat');
        onlineUsers++;
        io.emit("update user count", onlineUsers);
        socket.name = name;
        io.emit('user joined', name);
      });

      socket.on('chat message', (msg) => {
        socket.broadcast.emit('chat message', msg);
      });

      socket.on('sendPhoto', (file) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        const maxSize = 4 * 1024 * 1024; // 4MB

        if (!allowedTypes.includes(file.type)) {
          return socket.emit('error', 'Invalid file type');
        }

        if (file.size > maxSize) {
          return socket.emit('error', 'File too large');
        }

        const uploadStream = bucket.openUploadStream(file.name);
        const readableStream = new stream.PassThrough();
        readableStream.end(file.data);
        readableStream.pipe(uploadStream);

        uploadStream.on('finish', () => {
          io.emit('receivePhoto', { fileId: uploadStream.id, filename: file.name });
        });

        uploadStream.on('error', (err) => {
          console.error('Upload error:', err);
          socket.emit('error', 'Upload failed');
        });
      });

      socket.on('join room', async ({ roomId, name }) => {
        socket.join(roomId);
        roomUserCounts[roomId] = (roomUserCounts[roomId] || 0) + 1;
        io.to(roomId).emit("update count", roomUserCounts[roomId]);
        console.log(name + ' has joined the room ' + roomId);

        try {
          const messages = await Message.find({ roomId });
          socket.emit('previous messages', messages.map(msg => ({
            receiver: msg.receiver,
            sender: msg.sender,
            text: msg.text
          })));
        } catch (error) {
          console.error('Error retrieving messages:', error);
          socket.emit('error', 'Failed to retrieve previous messages');
        }

        socket.uname = name;
        socket.room = roomId;
        io.to(roomId).emit('join room', name);
      });

      socket.on('private message', async (msg) => {
        console.log('Received message:', msg); // Log the entire message object
      
        // Check if the message is an object with the expected properties
        if (typeof msg === 'object' && msg.roomId && msg.sender && msg.receiver && msg.senderEmail && msg.text) {
          const { roomId, sender, receiver,senderEmail, text } = msg;
      
          // Create a new Message instance with the received data
          const message = new Message({ roomId, sender, receiver,senderEmail, text });
      
          try {
            // Save the message to the database
            await message.save();
            // Broadcast the message to the room
            socket.broadcast.to(roomId).emit('private message', { sender, receiver, text });
          } catch (error) {
            console.error('Error saving message:', error);
            socket.emit('error', 'Failed to save message');
          }
        } else {
          console.error('Invalid message format:', msg);
          socket.emit('error', 'Invalid message format');
        }
      });
      

      socket.on('disconnect', () => {
        const name = socket.name;
        const roomId = socket.room;
        const uname = socket.uname;

        if (name) {
          console.log(name + ' user disconnected');
          onlineUsers--;
          io.emit("update user count", onlineUsers);
          io.emit('user left', name);
        }

        if (roomId) {
          console.log(uname + ' user disconnected from room ' + roomId);
          socket.to(roomId).emit('leave room', uname);
          roomUserCounts[roomId] = (roomUserCounts[roomId] || 0) - 1;
          if (roomUserCounts[roomId] <= 0) {
            delete roomUserCounts[roomId];
          } else {
            io.to(roomId).emit("update count", roomUserCounts[roomId]);
          }
        }

        if (connectedUsers[name]) {
          delete connectedUsers[name];
          io.emit('update user list', Object.keys(connectedUsers));
        }
      });

      function updateOnlineUsers() {
        io.emit('update online users', Object.keys(io.sockets.sockets).map(id => io.sockets.sockets[id].name));
      }

      function updateRoomUserCount(roomId) {
        io.of('/').in(roomId).clients((error, clients) => {
          if (error) throw error;
          const onlineCount = clients.length;
          io.to(roomId).emit("update count", onlineCount);
        });
      }
    }); 

    server.listen(port, () => console.log(`Server started at: ${port}`));
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

initialize();
   
