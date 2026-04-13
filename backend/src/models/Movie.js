const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema(
  {
    movieId: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true },
    avg_rating: { type: Number, default: 0 },
    movielens_review_count: { type: Number, default: 0 },
    imdb_tconst: { type: String, default: null },
    imdb_primary_title: { type: String, default: null },
    year: { type: Number, default: null },
    categories: [{ type: String }],
    actors: [{ type: String }],
    directors: [{ type: String }],
    writers: [{ type: String }],
    crew: [{ type: String }],
    json_review_count: { type: Number, default: 0 }
  },
  { timestamps: false }
);

module.exports = mongoose.model('Movie', movieSchema);