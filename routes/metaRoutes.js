const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authToken");

const { connectFacebook, facebookCallback, getPages, savePage, getProfile } = require("../controllers/metaController");

router.get("/connect", verifyToken, connectFacebook);
router.get("/callback", facebookCallback);

router.get("/pages", verifyToken, getPages);
router.post("/page", verifyToken, savePage);

router.get("/profile", verifyToken, getProfile);
// router.get("/pages", metaController.getPages);

// router.get("/instagram/:pageId", metaController.getInstagramAccount);

// router.get("/instagram-profile", metaController.getInstagramProfile);

// router.get("/instagram-posts", metaController.getInstagramPosts);

// router.get("/comments/:mediaId", metaController.getPostComments);

// router.post("/reply-comment", metaController.replyComment);

// router.post("/create-post", metaController.createInstagramPost);

// router.post("/publish-post", metaController.publishInstagramPost);

// router.post("/facebook-post", metaController.postFacebookPage);

module.exports = router;