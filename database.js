const mongoose = require('mongoose');
require('dotenv').config()
const connectDb= async () => {
    try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('connected');
 return mongoose.connection;
} catch (error) {
     console.error(error); 
     process.exit(1);
}
}
module.exports=connectDb