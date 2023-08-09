const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  title: {
    type: "string",
    required: true,
    minlength: 1,
    trim: true,
  },

  _listId: {
    type: mongoose.Types.ObjectId,
    required: true,
  },

  completed: {

    type: Boolean,
    default: false
  }
});

const task = mongoose.model("task", taskSchema);

module.exports = { task };
