const express = require("express");
const Profile = require("../models/profile");
const router = express.Router();
const bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({ extended: true }));


router.get('/profile', (req,res)=>{

});