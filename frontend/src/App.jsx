import { useEffect, useState } from 'react';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000/api`;

const CATEGORY_OPTIONS = [
  'Comedy',
  'Drama',
  'Action',
  'Adventure',
  'Crime',
  'Romance',
  'Thriller',
  'Sci-Fi',
  'Animation',
  'Fantasy'
];

function formatRating(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return 'N/A';
  }

  return value.toFixed(1);
}

function formatDate(value) {
  if (!value) return 'Unknown date';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatCompactNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0';

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
}

function getMovieMeta(movie) {
  if (!movie) return 'No movie selected';

  const parts = [];

  if (movie.year) parts.push(movie.year);
  if (movie.categories?.length) parts.push(movie.categories.slice(0, 3).join(' • '));
  if (movie.imdb_primary_title && movie.imdb_primary_title !== movie.title) {
    parts.push(`IMDb: ${movie.imdb_primary_title}`);
  }

  return parts.join('  |  ') || 'Metadata unavailable';
}

async function readJson(url) {
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload;
}

export default function App() {
  const [status, setStatus] = useState({ label: 'Checking', tone: 'pending' });
  const [movies, setMovies] = useState([]);
  const [moviesPage, setMoviesPage] = useState(1);
  const [movieSearch, setMovieSearch] = useState('');
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [moviesError, setMoviesError] = useState('');

  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieDetailLoading, setMovieDetailLoading] = useState(false);
  const [movieDetailError, setMovieDetailError] = useState('');

  const [reviews, setReviews] = useState([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');

  const [featuredCategory, setFeaturedCategory] = useState(CATEGORY_OPTIONS[0]);
  const [featuredMovies, setFeaturedMovies] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState('');

  useEffect(() => {
    let active = true;

    readJson(`${API_BASE_URL}/status`)
      .then((data) => {
        if (!active) return;

        setStatus({
          label: data.mongo.connected ? 'Online' : 'Database offline',
          tone: data.mongo.connected ? 'success' : 'warning'
        });
      })
      .catch(() => {
        if (!active) return;

        setStatus({ label: 'API unavailable', tone: 'danger' });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    setMoviesLoading(true);
    setMoviesError('');

    readJson(`${API_BASE_URL}/movies?page=${moviesPage}&limit=12`)
      .then((payload) => {
        if (!active) return;

        setMovies(payload.data);
        setSelectedMovieId((current) => {
          if (current && payload.data.some((movie) => movie.movieId === current)) {
            return current;
          }

          return payload.data[0]?.movieId || null;
        });
      })
      .catch((error) => {
        if (!active) return;

        setMovies([]);
        setMoviesError(error.message);
      })
      .finally(() => {
        if (active) {
          setMoviesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [moviesPage]);

  useEffect(() => {
    let active = true;

    setFeaturedLoading(true);
    setFeaturedError('');

    readJson(`${API_BASE_URL}/best_movies?category=${encodeURIComponent(featuredCategory)}`)
      .then((payload) => {
        if (!active) return;
        setFeaturedMovies(payload.data);
      })
      .catch((error) => {
        if (!active) return;
        setFeaturedMovies([]);
        setFeaturedError(error.message);
      })
      .finally(() => {
        if (active) {
          setFeaturedLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [featuredCategory]);

  useEffect(() => {
    if (!selectedMovieId) {
      setSelectedMovie(null);
      setReviews([]);
      return;
    }

    let active = true;

    setMovieDetailLoading(true);
    setMovieDetailError('');

    readJson(`${API_BASE_URL}/movies/${selectedMovieId}`)
      .then((payload) => {
        if (!active) return;
        setSelectedMovie(payload.data);
      })
      .catch((error) => {
        if (!active) return;
        setSelectedMovie(null);
        setMovieDetailError(error.message);
      })
      .finally(() => {
        if (active) {
          setMovieDetailLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedMovieId]);

  useEffect(() => {
    if (!selectedMovieId) return;

    let active = true;

    setReviewsLoading(true);
    setReviewsError('');

    readJson(`${API_BASE_URL}/movies/${selectedMovieId}/reviews?page=${reviewsPage}&limit=5`)
      .then((payload) => {
        if (!active) return;
        setReviews(payload.data);
      })
      .catch((error) => {
        if (!active) return;
        setReviews([]);
        setReviewsError(error.message);
      })
      .finally(() => {
        if (active) {
          setReviewsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedMovieId, reviewsPage]);

  const visibleMovies = movies.filter((movie) => {
    const query = movieSearch.trim().toLowerCase();
    if (!query) return true;

    const haystacks = [
      movie.title,
      movie.imdb_primary_title,
      ...(movie.categories || []),
      ...(movie.directors || []),
      ...(movie.actors || [])
    ];

    return haystacks.some((entry) => String(entry || '').toLowerCase().includes(query));
  });

  const quickCategories = selectedMovie?.categories?.length
    ? Array.from(new Set([...selectedMovie.categories, ...CATEGORY_OPTIONS])).slice(0, 10)
    : CATEGORY_OPTIONS;

  const statCards = [
    {
      label: 'Movies in page',
      value: formatCompactNumber(movies.length)
    },
    {
      label: 'Featured picks',
      value: formatCompactNumber(featuredMovies.length)
    },
    {
      label: 'Reviews loaded',
      value: formatCompactNumber(reviews.length)
    }
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">UMDB Movie Explorer</p>
          <h1>Browse the lab dataset like a real streaming catalog.</h1>
          <p className="hero-copy">
            Explore imported movies, inspect the stored MongoDB metadata, and jump through review
            pages without leaving the dashboard.
          </p>
        </div>

        <div className="hero-panel">
          <div className={`status-pill ${status.tone}`}>{status.label}</div>
          <p className="hero-panel-copy">
            API base: <span>{API_BASE_URL}</span>
          </p>
          <div className="stats-grid">
            {statCards.map((stat) => (
              <article key={stat.label} className="stat-card">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <aside className="panel movie-list-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Catalog</p>
              <h2>Recent movies</h2>
            </div>
            <div className="pager">
              <button type="button" onClick={() => setMoviesPage((page) => Math.max(1, page - 1))}>
                Prev
              </button>
              <span>Page {moviesPage}</span>
              <button type="button" onClick={() => setMoviesPage((page) => page + 1)}>
                Next
              </button>
            </div>
          </div>

          <label className="search-field" htmlFor="movie-search">
            <span>Filter this page</span>
            <input
              id="movie-search"
              type="search"
              placeholder="Title, category, actor, director..."
              value={movieSearch}
              onChange={(event) => setMovieSearch(event.target.value)}
            />
          </label>

          {moviesLoading ? <p className="feedback">Loading movies...</p> : null}
          {moviesError ? <p className="feedback error">{moviesError}</p> : null}

          <div className="movie-list">
            {visibleMovies.map((movie) => (
              <button
                key={movie.movieId}
                type="button"
                className={`movie-card ${movie.movieId === selectedMovieId ? 'active' : ''}`}
                onClick={() => {
                  setSelectedMovieId(movie.movieId);
                  setReviewsPage(1);
                }}
              >
                <div className="movie-card-header">
                  <strong>{movie.title}</strong>
                  <span>{movie.year || 'Unknown year'}</span>
                </div>
                <p>{movie.categories?.slice(0, 3).join(' • ') || 'No categories'}</p>
                <div className="movie-card-footer">
                  <span>Rating {formatRating(movie.avg_rating)}</span>
                  <span>{movie.movielens_review_count || 0} ML reviews</span>
                </div>
              </button>
            ))}

            {!moviesLoading && !visibleMovies.length ? (
              <p className="feedback">No movies match this filter on the current page.</p>
            ) : null}
          </div>
        </aside>

        <section className="panel detail-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Details</p>
              <h2>{selectedMovie?.title || 'Select a movie'}</h2>
            </div>
            <div className="rating-badge">{formatRating(selectedMovie?.avg_rating)}</div>
          </div>

          <p className="meta-line">{getMovieMeta(selectedMovie)}</p>

          {movieDetailLoading ? <p className="feedback">Loading movie details...</p> : null}
          {movieDetailError ? <p className="feedback error">{movieDetailError}</p> : null}

          {selectedMovie ? (
            <>
              <div className="chips">
                {quickCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`chip ${featuredCategory === category ? 'active' : ''}`}
                    onClick={() => setFeaturedCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="detail-columns">
                <article className="detail-card">
                  <h3>Credits</h3>
                  <p>
                    <span>Directors</span>
                    {selectedMovie.directors?.join(', ') || 'Unavailable'}
                  </p>
                  <p>
                    <span>Writers</span>
                    {selectedMovie.writers?.join(', ') || 'Unavailable'}
                  </p>
                  <p>
                    <span>Actors</span>
                    {selectedMovie.actors?.slice(0, 6).join(', ') || 'Unavailable'}
                  </p>
                </article>

                <article className="detail-card">
                  <h3>Dataset fields</h3>
                  <p>
                    <span>MovieLens reviews</span>
                    {selectedMovie.movielens_review_count || 0}
                  </p>
                  <p>
                    <span>JSON reviews</span>
                    {selectedMovie.json_review_count || 0}
                  </p>
                  <p>
                    <span>IMDb title ID</span>
                    {selectedMovie.imdb_tconst || 'Unavailable'}
                  </p>
                </article>
              </div>

              <div className="reviews-section">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">Reviews</p>
                    <h3>Stored review text</h3>
                  </div>
                  <div className="pager">
                    <button
                      type="button"
                      onClick={() => setReviewsPage((page) => Math.max(1, page - 1))}
                    >
                      Prev
                    </button>
                    <span>Page {reviewsPage}</span>
                    <button type="button" onClick={() => setReviewsPage((page) => page + 1)}>
                      Next
                    </button>
                  </div>
                </div>

                {reviewsLoading ? <p className="feedback">Loading reviews...</p> : null}
                {reviewsError ? <p className="feedback error">{reviewsError}</p> : null}

                <div className="review-list">
                  {reviews.map((review) => (
                    <article key={review.review_id} className="review-card">
                      <div className="review-meta">
                        <strong>Rating {formatRating(review.rating)}</strong>
                        <span>{formatDate(review.timestamp)}</span>
                      </div>
                      <p>{review.text}</p>
                    </article>
                  ))}

                  {!reviewsLoading && !reviews.length ? (
                    <p className="feedback">No reviews found for this page.</p>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <p className="feedback">Pick a movie from the catalog to load full details.</p>
          )}
        </section>

        <aside className="panel featured-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Ranking</p>
              <h2>Best in {featuredCategory}</h2>
            </div>
          </div>

          {featuredLoading ? <p className="feedback">Loading category highlights...</p> : null}
          {featuredError ? <p className="feedback error">{featuredError}</p> : null}

          <div className="featured-list">
            {featuredMovies.map((movie, index) => (
              <button
                key={`${movie.movieId}-${featuredCategory}`}
                type="button"
                className="featured-card"
                onClick={() => {
                  setSelectedMovieId(movie.movieId);
                  setReviewsPage(1);
                }}
              >
                <span className="featured-rank">#{index + 1}</span>
                <div>
                  <strong>{movie.title}</strong>
                  <p>{movie.year || 'Unknown year'}</p>
                </div>
                <span className="featured-score">{formatRating(movie.avg_rating)}</span>
              </button>
            ))}

            {!featuredLoading && !featuredMovies.length ? (
              <p className="feedback">No movies returned for this category.</p>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
