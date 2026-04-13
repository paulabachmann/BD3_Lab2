const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    review_id: { type: Number, required: true, unique: true, index: true },
    movie_id: { type: Number, required: true, index: true },
    text: { type: String, required: true },
    rating: { type: Number, default: null },
    timestamp: { type: Date, default: null }
  },
  { timestamps: false }
);

module.exports = mongoose.model('Review', reviewSchema);