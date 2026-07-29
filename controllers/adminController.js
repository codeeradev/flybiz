const User = require("../models/user");
const jwt = require("jsonwebtoken");


const STATIC_AI_IMAGES = [
  {
    id: 1,
    type: "image",
    prompt:
      "Futuristic cityscape at golden hour with flying electric vehicles and neon holograms",
    userName: "Sophia Bennett",
    date: "Jul 10, 2025",
    thumbnailColor: "from-blue-500 to-purple-600",
    resolution: "1920x1080",
  },
  {
    id: 2,
    type: "image",
    prompt:
      "Minimalist luxury perfume bottle on black marble surface with dramatic lighting",
    userName: "James Rivera",
    date: "Jul 9, 2025",
    thumbnailColor: "from-gray-700 to-gray-900",
    resolution: "1080x1080",
  },
  {
    id: 3,
    type: "image",
    prompt:
      "Abstract neural network visualization in deep space with colorful synaptic connections",
    userName: "Marcus Chen",
    date: "Jul 9, 2025",
    thumbnailColor: "from-purple-600 to-pink-500",
    resolution: "1920x1080",
  },
  {
    id: 4,
    type: "image",
    prompt:
      "Artisan coffee shop interior with warm bokeh lights and exposed brick walls",
    userName: "Elena Vasquez",
    date: "Jul 8, 2025",
    thumbnailColor: "from-amber-600 to-orange-500",
    resolution: "1080x1350",
  },
  {
    id: 5,
    type: "image",
    prompt:
      "Hyper-realistic product shot of wireless headphones floating with water splashes",
    userName: "Noah Williams",
    date: "Jul 8, 2025",
    thumbnailColor: "from-cyan-500 to-blue-600",
    resolution: "1920x1080",
  },
  {
    id: 6,
    type: "image",
    prompt:
      "Sunset over rolling vineyard hills in Tuscany with warm terracotta tones",
    userName: "Isabella Moore",
    date: "Jul 7, 2025",
    thumbnailColor: "from-orange-400 to-rose-500",
    resolution: "1920x1080",
  },
  {
    id: 7,
    type: "image",
    prompt: "Tech startup team in modern glass office with city views at night",
    userName: "Ethan Wilson",
    date: "Jul 7, 2025",
    thumbnailColor: "from-slate-600 to-blue-700",
    resolution: "1080x1080",
  },
  {
    id: 8,
    type: "image",
    prompt:
      "Bioluminescent ocean wave crashing at night with glowing particles",
    userName: "Mia Davis",
    date: "Jul 6, 2025",
    thumbnailColor: "from-teal-500 to-blue-500",
    resolution: "1920x1080",
  },
  {
    id: 9,
    type: "image",
    prompt:
      "Luxury electric sports car on mountain road at dawn with misty atmosphere",
    userName: "Oliver Martinez",
    date: "Jul 6, 2025",
    thumbnailColor: "from-red-600 to-orange-500",
    resolution: "1920x1080",
  },
  {
    id: 10,
    type: "image",
    prompt:
      "Ethereal goddess portrait with floral crown surrounded by golden butterflies",
    userName: "Charlotte Brown",
    date: "Jul 5, 2025",
    thumbnailColor: "from-yellow-400 to-pink-500",
    resolution: "1080x1350",
  },
  {
    id: 11,
    type: "image",
    prompt:
      "Futuristic AI research lab with holographic displays and robotic arms",
    userName: "William Taylor",
    date: "Jul 5, 2025",
    thumbnailColor: "from-violet-600 to-indigo-700",
    resolution: "1920x1080",
  },
  {
    id: 12,
    type: "image",
    prompt:
      "Organic health food bowl with vibrant ingredients on rustic wooden surface",
    userName: "Harper Garcia",
    date: "Jul 4, 2025",
    thumbnailColor: "from-green-500 to-emerald-600",
    resolution: "1080x1080",
  },
];

const STATIC_AI_VIDEOS = [
  {
    id: 101,
    type: "video",
    prompt:
      "Brand intro animation with logo reveal and particle effects in blue-purple gradient",
    userName: "Marcus Chen",
    date: "Jul 10, 2025",
    thumbnailColor: "from-blue-600 to-purple-700",
    duration: "0:15",
  },
  {
    id: 102,
    type: "video",
    prompt:
      "Product showcase reel for wireless earbuds with 3D rotation and feature callouts",
    userName: "Sophia Bennett",
    date: "Jul 9, 2025",
    thumbnailColor: "from-gray-600 to-slate-800",
    duration: "0:30",
  },
  {
    id: 103,
    type: "video",
    prompt:
      "Time-lapse of sustainable packaging being assembled from recycled materials",
    userName: "Elena Vasquez",
    date: "Jul 8, 2025",
    thumbnailColor: "from-green-600 to-teal-700",
    duration: "0:45",
  },
  {
    id: 104,
    type: "video",
    prompt:
      "Cinematic travel montage: Santorini sunsets, Thai markets, and Tokyo streets",
    userName: "Noah Williams",
    date: "Jul 7, 2025",
    thumbnailColor: "from-orange-500 to-pink-600",
    duration: "1:00",
  },
  {
    id: 105,
    type: "video",
    prompt:
      "Explainer animation: How AI transforms social media content creation workflow",
    userName: "Ethan Wilson",
    date: "Jul 6, 2025",
    thumbnailColor: "from-purple-500 to-pink-600",
    duration: "1:30",
  },
  {
    id: 106,
    type: "video",
    prompt:
      "Fashion lookbook with model transitions and dynamic typography overlays",
    userName: "Isabella Moore",
    date: "Jul 5, 2025",
    thumbnailColor: "from-rose-500 to-red-600",
    duration: "0:45",
  },
  {
    id: 107,
    type: "video",
    prompt:
      "Corporate testimonial montage with smooth talking-head transitions",
    userName: "William Taylor",
    date: "Jul 4, 2025",
    thumbnailColor: "from-sky-500 to-blue-700",
    duration: "2:00",
  },
  {
    id: 108,
    type: "video",
    prompt:
      "Social media stories compilation with trending audio and text animations",
    userName: "Harper Garcia",
    date: "Jul 3, 2025",
    thumbnailColor: "from-fuchsia-500 to-violet-700",
    duration: "0:30",
  },
];

const buildAIContentResponse = (images, videos) => ({
  message: "AI content retrieved successfully",
  images,
  videos,
  totals: {
    images: images.length,
    videos: videos.length,
    all: images.length + videos.length,
  },
});


exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const admin = await User.findOne({ email, role: "admin" });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    if (password !== admin.password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { _id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
    );

    return res
      .status(200)
      .json({ message: "Admin logged in successfully", token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const id = req.admin;

    if (!id || id === null || id === undefined) {
      return res.status(400).json({ message: "Admin ID is required" });
    }

    const users = await User.find({
      role: { $ne: "admin" },
      _id: { $ne: id._id }
    });

    return res
      .status(200)
      .json({ message: "Users retrieved successfully", users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};


exports.getAdminAIContent = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(400).json({ message: "Admin authorization is required" });
    }

    const { type } = req.query;

    if (type && !["image", "video"].includes(type)) {
      return res.status(400).json({
        message: 'Invalid content type. Use "image" or "video".',
      });
    }

    if (type === "image") {
      return res.status(200).json(buildAIContentResponse(STATIC_AI_IMAGES, []));
    }

    if (type === "video") {
      return res.status(200).json(buildAIContentResponse([], STATIC_AI_VIDEOS));
    }

    return res
      .status(200)
      .json(buildAIContentResponse(STATIC_AI_IMAGES, STATIC_AI_VIDEOS));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};
