const express = require("express");
const User = require("../models/user");
const Contact = require('../models/contacts');
const router = express.Router();
const bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({ extended: true }));




//signup page directly open on clicking join
router.get('/', (req, res) => {
  res.render('signup', {err:false});// we put err as false to open it first time without warning
});
router.post("/signup", async(req,res)=>{
    const { name, email, password } = req.body; //taking input from user
    const existingUser = await User.findOne({ email });// checking if user already exist
   
    if (existingUser) {
      return res.redirect(`/user/login?userExists=true&email=${(email)}`); // if user exist redirecting to login page with warning
  }
    else{ //otherwise creating a new user in database
      await User.create({
        name,
        email,
        password,
      });
      return res.redirect("/user/login");
    }
});



//login page
router.get('/login',(req,res)=>{
  const{userExists, email} = req.query;
  res.render('login',{userExists, email,error: false});
})
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }); //checking if user is in database with email

  if(!user){ // if the email doesn't exist we send the user to signup page for signup with (err as true, to show the warning )
    return res.render("signup",{
      err: true,
    });
  } 
  else if ( user.password !== password) { //if user exist but input password doesn't match
      return res.render("login", {
          error: true,
      });
  } else {
    req.session.user = { name: user.name, email: user.email };
      return res.redirect('/user/chatselection'); //if everything goes well send the user for selecting his chat mode
  }
});

//this will redirect to chat selection
router.get('/chatselection',async(req,res)=>{
  return res.render('chatselect');
})

//this will redirect to private chatroom
router.get('/privatechat',async(req,res)=>{
  res.render('privatechat');
});

//this will redirect to public chatroom in 
router.get("/chat",async(req, res) => {
  return res.render('index');
 });

 router.get('/profile', (req, res) => {
  const { name, email } = req.session.user || {}; // Use fallback in case session.user is undefined
  if (!name || !email) {
    return res.redirect('/user/login');
  }
  res.render('profile', { name, email });
});


router.get('/chat/:contactEmail', (req, res) => {
  const contactEmail = req.params.contactEmail;
  console.log("Reached here");
  console.log('Contact Email:', contactEmail); // Log the contactEmail to debug
  res.render('chat', { contactEmail });
});



router.get('/onetoone',(req,res)=>{
  return res.render('onetoone');
})



//logout 
// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.redirect('/user/profile'); // Redirect to profile if there's an error
    }
    res.redirect('/user/login'); // Redirect to login page after successful logout
  });
});





// Assuming you have the routes correctly defined
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
          contactList: user.contacts
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


// Route to handle user search
// Route to handle user search
router.get('/contacts/search', async (req, res) => {
  try {
    const { query } = req.query;
    const currentUser = req.session.user;

    if (!currentUser) {
      return res.redirect('/user/login');
    }

    // Perform case-insensitive search for users
    const searchResults = await User.find({
      email: { $ne: currentUser.email },
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    });

    const user = await User.findOne({ email: currentUser.email });

    // Return the search results as JSON
    res.json({
      users: searchResults,
      contactList: user.contacts
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


router.get('/update-profile', (req, res) => {
  const { name, email } = req.session.user; 
  res.render('update-profile', { name, email, error: null });
});

router.post('/update-profile', async (req, res) => {
  const { name, email, currentPassword, newPassword, confirmNewPassword } = req.body;
  const { email: currentEmail } = req.session.user;

  try {
    // Fetch the user from the database
    const user = await User.findOne({ email: currentEmail });
    if (!user) {
      return res.render('update-profile', { name, email, error: 'User not found' });
    }

    // Validate current password
    if (user.password !== currentPassword) {
      return res.render('update-profile', { name, email, error: 'Current password is incorrect' });
    }

    // Validate new password
    if (newPassword !== confirmNewPassword) {
      return res.render('update-profile', { name, email, error: 'New passwords do not match' });
    }

    // Update user profile
    user.name = name || user.name;
    user.email = email || user.email;
    if (newPassword) {
      user.password = newPassword;
    }
    await user.save();

    // Update session with new email
    req.session.user.name = user.name;
    req.session.user.email = user.email;

    res.redirect('/user/profile');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.render('update-profile', { name, email, error: 'An error occurred while updating profile' });
  }
});




module.exports = router; //exporting the router