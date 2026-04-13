const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Movie = require('./models/Movie');
const Review = require('./models/Review');

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseJsonArray(value) {
  if (!value || String(value).trim() === '') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse JSON array field:', err.message);
    return [];
  }
}

function toDateFromTimestamp(value) {
  if (value === undefined || value === null || value === '') return null;

  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function importFromSingleCsv(csvPath) {
  const rows = await readCsv(csvPath);

  if (!rows.length) {
    console.log('No rows found in CSV');
    return;
  }

  const movieOps = [];
  const reviewOps = [];

  for (const row of rows) {
    const movieId = toNumber(row.movieId, 0);
    if (!movieId) continue;

    const categories = parseJsonArray(row.categories).map(String);
    const actors = parseJsonArray(row.actors).map(String);
    const directors = parseJsonArray(row.directors).map(String);
    const writers = parseJsonArray(row.writers).map(String);
    const crew = parseJsonArray(row.crew).map(String);

    const movieDoc = {
      movieId,
      title: row.title?.trim() || 'Untitled',
      avg_rating: toNumber(row.avg_rating, 0),
      movielens_review_count: toNumber(row.movielens_review_count, 0),
      imdb_tconst: row.imdb_tconst || null,
      imdb_primary_title: row.imdb_primary_title || null,
      year: toNumber(row.year, null),
      categories,
      actors,
      directors,
      writers,
      crew,
      json_review_count: toNumber(row.json_review_count, 0)
    };

    movieOps.push({
      updateOne: {
        filter: { movieId },
        update: { $set: movieDoc },
        upsert: true
      }
    });

    const parsedReviews = parseJsonArray(row.reviews);

    parsedReviews.forEach((review, index) => {
      const text = String(review.text || '').trim();
      if (!text) return;

      // review_id generado de forma determinística:
      // movieId * 100000 + índice local
      // suficiente si no esperás >100000 reviews por película
      const review_id = movieId * 100000 + index;

      reviewOps.push({
        updateOne: {
          filter: { review_id },
          update: {
            $set: {
              review_id,
              movie_id: movieId,
              text,
              rating: toNumber(review.rating, null),
              timestamp: toDateFromTimestamp(review.timestamp)
            }
          },
          upsert: true
        }
      });
    });
  }

  if (movieOps.length) {
    await Movie.bulkWrite(movieOps, { ordered: false });
    console.log(`Movies upserted: ${movieOps.length}`);
  }

  if (reviewOps.length) {
    const chunkSize = 5000;

    for (let i = 0; i < reviewOps.length; i += chunkSize) {
      const chunk = reviewOps.slice(i, i + chunkSize);
      await Review.bulkWrite(chunk, { ordered: false });
      console.log(
        `Reviews processed: ${Math.min(i + chunk.length, reviewOps.length)}/${reviewOps.length}`
      );
    }
  }

  console.log('Import completed');
}

async function seedOnStartup() {
  const csvPath = path.join(__dirname, 'data', 'movies_with_reviews.csv');
  console.log('Starting CSV import...');
  await importFromSingleCsv(csvPath);
  console.log('CSV import finished.');
}

module.exports = { seedOnStartup };