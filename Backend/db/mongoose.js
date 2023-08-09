const mongoose = require("mongoose");
const colors = require("colors");

mongoose.Promise = global.Promise;

mongoose
  .connect(
    "mongodb+srv://Amey45:Amey45@webdev.kioovy1.mongodb.net/TaskManager",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("connected to mongodb database successfully".bgBlue.white);
  })
  .catch((e) => {
    console.log("Error connecting to mongodb database".bgRed.white);
    console.log(e);
  });

module.exports = { mongoose };
