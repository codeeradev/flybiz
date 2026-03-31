const express = require("express");
require("dotenv").config();
const connectDb = require("./database");
const http = require("http");
const cors = require("cors");
const path = require("path");

connectDb();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const server = http.createServer(app);

const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const imageRoutes = require("./routes/imageRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
// const metaRoutes = require("./routes/metaRoutes");

app.get("/", (req, res) => {
  res.send("FLyBiz api is running ...");
});

app.use("/assets", express.static(path.join(__dirname, "assets")));

app.use("/admin", adminRoutes);
app.use("/auth", authRoutes);
app.use("/ai", imageRoutes);
app.use("/settings", settingsRoutes);
// app.use("/meta", metaRoutes);

const startServer = async () => {
  const mongoConnection = await connectDb();

  // const agenda = await initAgenda(mongoConnection);
  // backgroundInvoice(agenda);

  const PORT = process.env.PORT || 9000;

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
