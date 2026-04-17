const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    username: {type: String, required: true, unique: true, index: ture},
    password: {type: String, required: true, select: false},
    watchlist: {type: [Number], default: []}
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);