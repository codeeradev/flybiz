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

const authRoutes = require("./routes/authRoutes");

app.get("/", (req, res) => {
  res.send("FLyBiz api is running ...");
});

app.use("/auth", authRoutes);

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
