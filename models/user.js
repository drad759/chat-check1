const mongoose =require("mongoose");
const userSchema = new mongoose.Schema({ //creating a user schema for taking data in this format
    name:{
        type:String,
        required: true,
    }, 
    email:{
        type:String,
        required: true,
    },

    password:{
        type:String,
        required:true,
    },

    profilePicture: {
        type: String, // Add a field for profile pictures
        default: '/default-profile.png'
      },
      contacts: [
        {
          contactEmail: {
            type: String,
            required: true
          },
          contactName: {
            type: String
          },
          profilePicture: {
            type: String
          }
        }
      ]


},{
    timestamps: true
},);

const User = mongoose.model('User',userSchema);
 //exporting the format (user model)
module.exports = User;
