exports.getweeklyAnalytics = async (req, res) => {
  try {
    const dailyEngagements = [
      { day: "Mon", value: 560 },
      { day: "Tue", value: 640 },
      { day: "Wed", value: 450 },
      { day: "Thu", value: 660 },
      { day: "Fri", value: 530 },
      { day: "Sat", value: 330 },
      { day: "Sun", value: 390 },
    ];

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          period: "this_week",
          totalEngagements: 4280,
          growthPercentage: 23.1,
          topPerformingDay: "Thu",
        },
        dailyEngagements,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Error fetching dashboard analytics",
    });
  }
};

exports.getRecentPosts = async (req, res) => {
  try {
    const recentPosts = [
      {
        id: "post-1",
        title: "Spring Sale Launch",
        platform: "instagram",
        publishedAt: "2026-04-08T08:00:00Z",
        metrics: {
          impressions: 12400,
          likes: 820,
          comments: 120,
          shares: 60,
        },
      },
      {
        id: "post-2",
        title: "New Menu Reveal",
        platform: "facebook",
        publishedAt: "2026-04-07T10:00:00Z",
        metrics: {
          impressions: 8200,
          likes: 430,
          comments: 70,
          shares: 25,
        },
      },
    ];

    return res.status(200).json({
      success: true,
      data: {
        recentPosts,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Error fetching recent posts",
    });
  }
};

exports.getPlans = async (req, res) => {
  try {
    const plans = [
      {
        id: "launch",
        name: "Launch",
        pricing: {
          amount: 0,
          currency: "INR",
          interval: "month",
          isFree: true,
        },
        limits: {
          campaignsPerMonth: 3,
        },
        features: [
          "3 campaigns / month",
          "Basic analytics",
          "Community support",
        ],
        isRecommended: false,
      },
      {
        id: "momentum",
        name: "Momentum",
        pricing: {
          amount: 499,
          currency: "INR",
          interval: "month",
          isFree: false,
        },
        limits: {
          campaignsPerMonth: null,
        },
        features: [
          "Unlimited campaigns",
          "Advanced analytics",
          "AI content suggestions",
          "Priority support",
        ],
        isRecommended: true,
      },
    ];

    return res.status(200).json({
      success: true,
      data: {
        plans,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Error fetching plans",
    });
  }
};
