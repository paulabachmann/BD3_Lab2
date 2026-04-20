const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Movie = require('./models/Movie');
const Review = require('./models/Review');

const EXPECTED_HEADERS = [
  'movieId',
  'title',
  'avg_rating',
  'movielens_review_count',
  'imdb_tconst',
  'imdb_primary_title',
  'year',
  'categories',
  'actors',
  'directors',
  'writers',
  'crew',
  'json_review_count',
  'reviews'
];

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseJsonArray(value, context = {}) {
  if (!value || String(value).trim() === '') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    const normalizedValue = String(value)
      .trim()
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');

    try {
      const parsed = JSON.parse(normalizedValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch (normalizedErr) {
      const fieldText = context.field ? ` field=${context.field}` : '';
      const rowText = context.rowNumber ? ` row=${context.rowNumber}` : '';
      const movieText = context.movieId ? ` movieId=${context.movieId}` : '';

      throw new Error(
        `Failed to parse JSON array${fieldText}${rowText}${movieText}: ${normalizedErr.message}`
      );
    }
  }
}

function parseReviews(value, context = {}) {
  const parsed = parseJsonArray(value, context);

  return parsed
    .filter((review) => review && typeof review === 'object' && !Array.isArray(review))
    .map((review) => ({
      text: typeof review.text === 'string' ? review.text : String(review.text || ''),
      rating: toNumber(review.rating, null),
      timestamp: review.timestamp
    }));
}

function toShortText(value, maxLength = 10000) {
  const text = String(value || '').trim();
  return text.length <= maxLength ? text : null;
}

function toReviewId(movieId, index) {
  return movieId * 100000 + index;
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
    let lineNumber = 1;

    fs.createReadStream(filePath)
      .pipe(
        csv({
          separator: ',',
          escape: '\\',
          mapHeaders: ({ header }) => header.trim()
        })
      )
      .on('headers', (headers) => {
        const normalizedHeaders = headers.map((header) => header.trim());
        const sameLength = normalizedHeaders.length === EXPECTED_HEADERS.length;
        const sameHeaders = sameLength &&
          normalizedHeaders.every((header, index) => header === EXPECTED_HEADERS[index]);

        if (!sameHeaders) {
          reject(
            new Error(
              `Invalid CSV headers. Expected ${EXPECTED_HEADERS.join(',')} but got ${normalizedHeaders.join(',')}`
            )
          );
          return;
        }
      })
      .on('data', (row) => {
        lineNumber += 1;
        rows.push({ ...row, __rowNumber: lineNumber });
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function validateRowShape(row) {
  const rowNumber = row.__rowNumber || '?';
  const missingHeaders = EXPECTED_HEADERS.filter((header) => row[header] === undefined);

  if (missingHeaders.length) {
    throw new Error(`Malformed row row=${rowNumber}: missing fields ${missingHeaders.join(',')}`);
  }

  const movieId = toNumber(row.movieId, null);
  if (!movieId) {
    throw new Error(`Malformed row row=${rowNumber}: invalid movieId="${row.movieId}"`);
  }

  return movieId;
}

async function importFromSingleCsv(csvPath) {
  const rows = await readCsv(csvPath);

  if (!rows.length) {
    console.log('No rows found in CSV');
    return;
  }

  const movieOps = [];
  const reviewOps = [];
  let skippedRows = 0;

  for (const row of rows) {
    const rowNumber = row.__rowNumber || '?';

    try {
      const movieId = validateRowShape(row);
      if (row.json_review_count>5000) continue;
      const categories = parseJsonArray(row.categories, {
        field: 'categories',
        rowNumber,
        movieId
      }).map(String);
      const actors = parseJsonArray(row.actors, {
        field: 'actors',
        rowNumber,
        movieId
      }).map(String);
      if (actors.length>100) continue;
      const directors = parseJsonArray(row.directors, {
        field: 'directors',
        rowNumber,
        movieId
      }).map(String);
      const writers = parseJsonArray(row.writers, {
        field: 'writers',
        rowNumber,
        movieId
      }).map(String);
      const crew = parseJsonArray(row.crew, {
        field: 'crew',
        rowNumber,
        movieId
      }).map(String);
      const parsedReviews = parseReviews(row.reviews, {
        field: 'reviews',
        rowNumber,
        movieId
      });

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

      parsedReviews.forEach((review, index) => {
        const text = toShortText(review.text);
        if (!text) return;

        const review_id = toReviewId(movieId, index);

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
    } catch (error) {
      skippedRows += 1;
      console.error(`Skipping row row=${rowNumber}: ${error.message}`);
    }
  }

  if (movieOps.length) {
    try {
      await Movie.bulkWrite(movieOps, { ordered: false });
      console.log(`Movies upserted: ${movieOps.length}`);
    } catch (error) {
      console.error(`Error occurred while upserting movies: ${error.message}`);
    }
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

  console.log(`Import completed. Skipped rows: ${skippedRows}`);
}

async function seedOnStartup() {
  const csvPath = path.join(__dirname, 'data', 'movies_with_reviews.csv');
  console.log('Starting CSV import...');
  await importFromSingleCsv(csvPath);
  console.log('CSV import finished.');
}

module.exports = { seedOnStartup };
