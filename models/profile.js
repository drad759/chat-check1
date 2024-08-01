const mongoose = require('mongoose');
const profileSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    bio: String,
    avatar: String
  });
  //here we are exporting profileSchema as Profile.
  module.exports = mongoose.model("Profile", profileSchema);
