const mongoose = require("mongoose");
const databaseURL = "mongodb://127.0.0.1:27017/" + process.env.DB_NAME;

const connectFunction = {
  DBconnect: async () => {
    try{
      mongoose.connect(databaseURL);
  
      const db = mongoose.connection;
      db.on("error", console.error.bind(console, "MongoDB connection error:"));
      db.once("open", () => {
        console.log(`Connected to MongoDB database ${process.env.DB_NAME}`);
      });
    }catch(err){
      console.log("an connection problem in"+ process.env.DB_NAME);
    }
  },
};

module.exports = connectFunction;
