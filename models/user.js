const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    mobileNumber:{type:String},
    email:{type:String},
    name:{type:String},
    image:{type:String},
},{timestamps:true})
module.exports=mongoose.model('user',userSchema)
