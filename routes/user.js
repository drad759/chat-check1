const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const multerMemoryStorage = multer.memoryStorage();

const stream = require('stream');
const User = require('../models/user');


const router = express.Router();
const bodyParser = require('body-parser');



// Middleware
router.use(bodyParser.urlencoded({ extended: true }));

// Signup page
router.get('/', (req, res) => {
  res.render('signup', { err: false });
});

// Handle Signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.redirect(`/user/login?userExists=true&email=${email}`);
    }

    await User.create({ name, email, password });
    return res.redirect('/user/login');
  } catch (error) {
    console.error('Error signing up:', error);
    res.redirect('/user/login');
  }
});

// Login page
router.get('/login', (req, res) => {
  const { userExists, email } = req.query;
  res.render('login', { userExists, email, error: false });
});

// Handle Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render('signup', { err: true });
    } else if (user.password !== password) {
      return res.render('login', { error: true });
    } else {
      req.session.user = { name: user.name, email: user.email };
      return res.redirect('/user/chatselection');
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.redirect('/user/login');
  }
});

// Chat Selection Page
router.get('/chatselection', (req, res) => {
  res.render('chatselect');
});

// Private Chatroom Page
router.get('/privatechat', (req, res) => {
  res.render('privatechat');
});

// Public Chatroom Page
router.get('/chat', (req, res) => {
  res.render('index');
});

// Profile Page
router.get('/profile', (req, res) => {
  const { name, email } = req.session.user || {};
  if (!name || !email) {
    return res.redirect('/user/login');
  }
  res.render('profile', { name, email });
});

// Chat with Contact
router.get('/chat/:contactEmail', (req, res) => {
  const contactEmail = req.params.contactEmail;
  const { email: userEmail } = req.session.user;

  if (!userEmail) {
    return res.redirect('/user/login');
  }
  res.render('chat', { contactEmail, userEmail });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.redirect('/user/profile');
    }
    res.redirect('/user/login');
  });
});

// Contacts
router.get('/contacts', async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser) {
      return res.redirect('/user/login');
    }
    
    const allUsers = await User.find({ email: { $ne: currentUser.email } });
    const user = await User.findOne({ email: currentUser.email });

    res.render('contacts', {
     
      users: allUsers,
      contactList: user.contacts,
      currentUser
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.post('/contacts/add', async (req, res) => {
  try {
    const { email } = req.session.user;
    const { contactEmail } = req.body;

    if (!contactEmail) {
      return res.status(400).json({ message: 'Contact email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const existingContact = user.contacts.find(contact => contact.contactEmail === contactEmail);
    if (existingContact) {
      return res.status(400).json({ message: 'Contact already added' });
    }

    const contact = await User.findOne({ email: contactEmail });
    if (!contact) {
      return res.status(400).json({ message: 'Contact not found' });
    }

    user.contacts.push({
      contactEmail: contactEmail,
      contactName: contact.name,
      profilePicture: contact.profilePicture
    });
    await user.save();

    res.json({ message: 'Contact added successfully' });
  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.post('/contacts/remove', async (req, res) => {
  try {
    const { email } = req.session.user;
    const { contactEmail } = req.body;

    if (!contactEmail) {
      return res.status(400).json({ message: 'Contact email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    user.contacts = user.contacts.filter(contact => contact.contactEmail !== contactEmail);
    await user.save();

    const contact = await User.findOne({ email: contactEmail });
    if (contact) {
      contact.contacts = contact.contacts.filter(contact => contact.contactEmail !== email);
      await contact.save();
    }

    res.json({ message: 'Contact removed successfully' });
  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Search Users
router.get('/contacts/search', async (req, res) => {
  try {
    const { query } = req.query;
    const currentUser = req.session.user;

    if (!currentUser) {
      return res.redirect('/user/login');
    }

    const searchResults = await User.find({
      email: { $ne: currentUser.email },
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    });

    const user = await User.findOne({ email: currentUser.email });

    res.json({
      users: searchResults,
      contactList: user.contacts
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Example: Mark messages as read when user opens the chatroom
router.post('/contacts/markAsRead', async (req, res) => {
  const { userEmail } = req.body;
  await Message.updateMany({ receiverEmail: userEmail, status: 'unread' }, { $set: { status: 'read' } });
  res.send({ message: 'Messages marked as read' });
});


// Update Profile Page
router.get('/update-profile', (req, res) => {
 

  const { name, email } = req.session.user || {};
  res.render('update-profile', { name, email, error: null });
});

// Handle Update Profile
router.post('/update-profile', async (req, res) => {
  const { name, email, currentPassword, newPassword, confirmNewPassword } = req.body;
  const { email: currentEmail } = req.session.user;

  try {
    const user = await User.findOne({ email: currentEmail });
    if (!user) {
      return res.render('update-profile', { name, email, error: 'User not found' });
    }

    if (user.password !== currentPassword) {
      return res.render('update-profile', { name, email, error: 'Current password is incorrect' });
    }

    if (newPassword !== confirmNewPassword) {
      return res.render('update-profile', { name, email, error: 'New passwords do not match' });
    }

    user.name = name || user.name;
    user.email = email || user.email;
    if (newPassword) {
      user.password = newPassword;
    }

    await user.save();
    req.session.user.name = user.name;
    req.session.user.email = user.email;

    res.redirect('/user/profile');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.render('update-profile', { name, email, error: 'An error occurred while updating profile' });
  }
});

// Video Call Page
router.get('/videocall', (req, res) => {
  const roomId = req.query.room;
  res.render('videocall', { RoomId: roomId });
});

// ChatGPT Endpoint
router.post('/chatgpt', async (req, res) => {
  try {
    const userMessage = req.body.message;

    const response = await openai.completions.create({
      model: 'gpt-3.5-turbo',
      prompt: userMessage,
      max_tokens: 150
    });

    const chatResponse = response.choices[0].text.trim();
    res.json({ response: chatResponse });
  } catch (error) {
    console.error('Error communicating with OpenAI:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Create Room ID Function
const rooms = {};
function createRoomId(user1, user2) {
  const combinedEmails = `${user1}_${user2}`;
  const sortedCombined = combinedEmails.split('').sort().join('');
  return sortedCombined;
}

// Chat Room Page
router.get('/chat1/:roomId?', (req, res) => {
  const { name, email } = req.session.user || {};
  const { roomId } = req.params;
  const { user1Email, user1Name, user2Name, user2Email } = req.query;
  const receiverEmail = user1Email;

  if (user1Email && user2Email) {
    const generatedRoomId = createRoomId(user1Email, user2Email);

    if (!rooms[generatedRoomId]) {
      rooms[generatedRoomId] = { users: [user1Email, user2Email] };
    }

    res.render('chat1', { roomId: generatedRoomId, user1Name, user2Name, name, receiverEmail,user2Email });
  } else if (roomId && rooms[roomId]) {
    res.render('chat1', { roomId, user1Name, user2Name, name, receiverEmail,user2Email });
  } else {
    res.status(400).send('Invalid room ID or missing parameters');
  }
});


router.post('/messages/read', async (req, res) => {
  const { roomId, receiver } = req.body;

  try {
    await Message.updateMany({ roomId, receiver, read: false }, { read: true });
    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Upload image route
const upload = multer({ storage: multerMemoryStorage });
router.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const bucket = getBucket(); // Use getBucket to get the initialized bucket
    const uploadStream = bucket.openUploadStream(req.file.originalname);
    const readableStream = new stream.PassThrough();
    readableStream.end(req.file.buffer);
    readableStream.pipe(uploadStream);

    uploadStream.on('finish', () => {
      res.json({ fileId: uploadStream.id, filename: req.file.originalname });
    });

    uploadStream.on('error', (err) => {
      console.error('Upload error:', err);
      res.status(500).json({ error: err.message });
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});





module.exports = router;
