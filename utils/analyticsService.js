const STAR_RATING_MAP = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

const getNumericRating = (rating) => {
  if (typeof rating === "number") {
    return rating;
  }

  if (typeof rating === "string") {
    const numericRating = Number(rating);

    if (!Number.isNaN(numericRating)) {
      return numericRating;
    }

    return STAR_RATING_MAP[rating.toUpperCase()] || 0;
  }

  return 0;
};

const analyzeReviews = (reviews) => {
  const totalReviews = reviews.length;

  if (!totalReviews) {
    return {
      totalReviews: 0,
      averageRating: 0,
    };
  }

  const ratingSum = reviews.reduce(
    (sum, r) => sum + getNumericRating(r.starRating),
    0,
  );

  const averageRating = ratingSum / totalReviews;

  return {
    totalReviews,
    averageRating,
  };
};

module.exports = {
  analyzeReviews,
};
