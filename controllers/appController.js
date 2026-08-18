exports.getInsights = async (req, res) => {
  try {
    const userId = req.user;

    const data = {
      social = [
        {
          title: "Instagram Followers",
          value: "18.6K",
          icon: "/assets/uploads/1774003118588-56955764.jpg",
          growth: 12,

          username: "@yourbusiness",
          status: "active",
          connectedOn: "12 May 2025",

          metricType: "followers",
          metricValue: "18.6K",

          secondaryMetricType: "engagement",
          secondaryMetricValue: "3.2%",
        },
        {
          title: "Facebook Followers",
          value: "12.4K",
          icon: "/assets/uploads/1774003118588-56955764.jpg",
          growth: 9,

          username: "Your Business",
          status: "active",
          connectedOn: "10 May 2025",

          metricType: "followers",
          metricValue: "12.4K",

          secondaryMetricType: "engagement",
          secondaryMetricValue: "2.8%",
        },
        {
          title: "Automation Status",
          value: "98%",
          icon: "/assets/uploads/1774003118588-56955764.jpg",
          statusText: "Active",
        },
        {
          title: "Website SEO Score",
          value: "86/100",
          icon: "/assets/uploads/1774003118588-56955764.jpg",
          growth: 8,

          username: "flybiz.com",
          status: "active",
          connectedOn: "05 May 2025",

          metricType: "sessions",
          metricValue: "5.6K",

          secondaryMetricType: "bounce_rate",
          secondaryMetricValue: "42%",
        },
        {
          title: "Google",
          value: "86/100",
          icon: "/assets/uploads/1774003118588-56955764.jpg",
          growth: 8,

          username: "Your Business",
          status: "active",
          connectedOn: "08 May 2025",

          metricType: "views",
          metricValue: "8.7K",

          secondaryMetricType: "interactions",
          secondaryMetricValue: "1.9K",
        },
      ],
      posts = [
        {
          title: "Total Posters",
          value: 128,
          icon: "/assets/uploads/1774003118588-56955764.jpg",
          growth: 28,
        },
        {
          title: "Video Posts",
          value: 56,
          icon: "/assets/uploads/1774003118588-56955764.jpg",
          growth: 18,
        },
      ],
    };

    return res.status(200).json({
      status: 1,
      data,
      totalAccount: 6,
      connectedAccount: 5,
    });
  } catch (error) {
    console.error("Error fetching insights:", error);
    return res.status(500).json({ error: "Failed to fetch insights" });
  }
};
