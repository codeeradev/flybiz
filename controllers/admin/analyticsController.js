const SUMMARY = [
  {
    label: "Total Generations",
    value: "326.4K",
    change: "+24.8%",
    trend: "up",
  },
  {
    label: "Total Engagement",
    value: "2.1M",
    change: "+18.2%",
    trend: "up",
  },
  {
    label: "User Growth Rate",
    value: "48.3%",
    change: "+12.1%",
    trend: "up",
  },
  {
    label: "Avg. Posts/User",
    value: "7.2",
    change: "-2.4%",
    trend: "down",
  },
];

const AI_GENERATION_TREND = [
  { month: "Aug '24", images: 4200, videos: 1100, total: 5300 },
  { month: "Sep '24", images: 5800, videos: 1450, total: 7250 },
  { month: "Oct '24", images: 7100, videos: 1920, total: 9020 },
  { month: "Nov '24", images: 8900, videos: 2340, total: 11240 },
  { month: "Dec '24", images: 12400, videos: 3100, total: 15500 },
  { month: "Jan '25", images: 9800, videos: 2600, total: 12400 },
  { month: "Feb '25", images: 11200, videos: 2980, total: 14180 },
  { month: "Mar '25", images: 14500, videos: 3800, total: 18300 },
  { month: "Apr '25", images: 16200, videos: 4200, total: 20400 },
  { month: "May '25", images: 18900, videos: 4890, total: 23790 },
  { month: "Jun '25", images: 22400, videos: 5600, total: 28000 },
  { month: "Jul '25", images: 26800, videos: 6700, total: 33500 },
];

const SOCIAL_ENGAGEMENT_BASE = [
  { day: "Mon", instagram: 4200, facebook: 2100, twitter: 1800, linkedin: 890 },
  {
    day: "Tue",
    instagram: 3800,
    facebook: 1900,
    twitter: 2100,
    linkedin: 1200,
  },
  {
    day: "Wed",
    instagram: 5200,
    facebook: 2800,
    twitter: 2400,
    linkedin: 1450,
  },
  { day: "Thu", instagram: 4900, facebook: 2400, twitter: 1900, linkedin: 980 },
  {
    day: "Fri",
    instagram: 6800,
    facebook: 3200,
    twitter: 3100,
    linkedin: 1890,
  },
  { day: "Sat", instagram: 8900, facebook: 4100, twitter: 2600, linkedin: 670 },
  { day: "Sun", instagram: 7400, facebook: 3600, twitter: 2200, linkedin: 540 },
];

const DAILY_ANALYTICS_START = new Date("2025-04-11T00:00:00Z");

function formatDayLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function scaleMetric(value, multiplier) {
  return Math.round(value * multiplier);
}

const SOCIAL_ENGAGEMENT = Array.from({ length: 365 }, (_, index) => {
  const base = SOCIAL_ENGAGEMENT_BASE[index % SOCIAL_ENGAGEMENT_BASE.length];
  const currentDate = new Date(DAILY_ANALYTICS_START);
  currentDate.setUTCDate(DAILY_ANALYTICS_START.getUTCDate() + index);

  const weekGrowth = 1 + Math.floor(index / 7) * 0.006;
  const monthlyPulse = index % 30 >= 24 ? 1.08 : 1;
  const dailyVariance = 1 + ((index % 5) - 2) * 0.02;
  const multiplier = weekGrowth * monthlyPulse * dailyVariance;

  return {
    day: formatDayLabel(currentDate),
    instagram: scaleMetric(base.instagram, multiplier),
    facebook: scaleMetric(base.facebook, multiplier * 0.98),
    twitter: scaleMetric(base.twitter, multiplier * 1.01),
    linkedin: scaleMetric(base.linkedin, multiplier * 1.03),
  };
});

const USER_GROWTH = [
  { month: "Aug '24", users: 1200, newUsers: 380 },
  { month: "Sep '24", users: 1680, newUsers: 480 },
  { month: "Oct '24", users: 2240, newUsers: 560 },
  { month: "Nov '24", users: 2980, newUsers: 740 },
  { month: "Dec '24", users: 3890, newUsers: 910 },
  { month: "Jan '25", users: 4780, newUsers: 890 },
  { month: "Feb '25", users: 5890, newUsers: 1110 },
  { month: "Mar '25", users: 7340, newUsers: 1450 },
  { month: "Apr '25", users: 9120, newUsers: 1780 },
  { month: "May '25", users: 11400, newUsers: 2280 },
  { month: "Jun '25", users: 14200, newUsers: 2800 },
  { month: "Jul '25", users: 17800, newUsers: 3600 },
];

exports.getAdminAnalytics = async (req, res) => {
  try {
    if (!req.admin) {
      return res
        .status(400)
        .json({ message: "Admin authorization is required" });
    }

    return res.status(200).json({
      message: "Analytics retrieved successfully",
      summary: SUMMARY,
      aiGenerationTrend: AI_GENERATION_TREND,
      socialEngagement: SOCIAL_ENGAGEMENT,
      userGrowth: USER_GROWTH,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};
