const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { seedOnStartup } = require('./seed');
const Movie = require('./models/Movie');
const Review = require('./models/Review');
const User = require('./models/user');

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/umdb';

app.use(cors());
app.use(express.json());

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    service: 'umdb-template-backend',
    mongo: {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState
    }
  });
});

app.get('/api/movies', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const movies = await Movie.find({})
      .sort({ year: -1, title: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ ok: true, data: movies, page, limit });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/movies/:movieId', async (req, res) => {
  try {
    const movieId = Number(req.params.movieId);
    const movie = await Movie.findOne({ movieId }).lean();

    if (!movie) {
      return res.status(404).json({ ok: false, error: 'Movie not found' });
    }

    res.json({ ok: true, data: movie });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/movies/:movieId/reviews', async (req, res) => {
  try {
    const movieId = Number(req.params.movieId);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ movie_id: movieId })
      .sort({ timestamp: -1, review_id: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ ok: true, data: reviews, page, limit });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/best_movies', async (req, res) => {
  try {
    const category = req.query.category || 'Comedy';

    const movies = await Movie.find({
      avg_rating: { $gt: 0 },
      categories: category
    })
      .sort({ avg_rating: -1, movielens_review_count: -1 })
      .limit(10)
      .lean();

    res.json({ ok: true, data: movies });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/user', async (req, res) => {
  try{
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? '').trim();
    if (!user || !password){
      return res.status(400).json({ message: "Username and password are required fields." });
    }
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({username, hashedPassword});
    return res.status(201).json({
      message: "User created successfully",
      user: newUser
    });
  } catch (error){
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Username already exists"
      });
    }
    return res.status(500).json({message: "The user could not be created", error: error.message,});
    }
});

app.get('/api/users/:username', async (req, res) => {
  try{
    const username = req.params.username;
    const user = await User.findOne({username});
    if (!user){
      return res.status(400).json({message: "User does not exist."});
    }

    res.json({ok: true, user});

  } catch (error){
    return res.status(500).json({message: "The users info could not be fetched.", error: error.message});
    }
  });

app.get('/api/users/:username/watchlist', async (req, res) => {
  try{
    const username = req.params.username;
    
    const user = await User.findOne({username});
    if (!user){
      return res.status(400).json({message: "User does not exist."});
    }
    const watchlist = user.watchlist;

    res.json({ok: true, watchlist});
  } catch (error){
    return res.status(500).json({message: "The watchlist could not be fetched.", error: error.message});
    }
})

app.post('/api/users/:username/watchlist', async(req, res) => {
  try{
    const username = req.params.username;
    const movieId = Number((req.body?.movieId?? "").trim());
    if (!username || movieId.isNaN){
      return res.status(400).json({message: "Username or movieId is missing."})
    }
    const result = await User.updateOne({ username }, { $addToSet: { watchlist: movieId }});
    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "User not found"
      });
    }
    res.json({ok:true})
  } catch(error){
    return res.status(500).json({message: "The movie could not be added to the watchlist.", error: error.message});
  }
})

app.delete('/api/users/:username/watchlist/:movieId', async (req,res) => {
  try{
    const username= req.params.username;
    const movieId = Number(req.params.movieId);
    if (!username || !movieId){
      return res.status(400).json({message: "Username or movieId is missing."})
    }
   const result = await User.updateOne(
    { username: username },
    { $pull: { watchlist : movieId } })
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "User not found"
      });
  } 
  return res.json({ok:true});

  } catch (error) {
    return res.status(500).json({message: "The movie could not be deleted from the watchlist.", error: error.message});
  }
});

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    await seedOnStartup();

    app.listen(PORT, () => {
      console.log(`Backend running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Startup failed:', error.message);
    process.exit(1);
  }
}

start();