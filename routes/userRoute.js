const express = require("express");
const router = express.Router();
const User = require("../models/user");
const authMiddleware = require("../middleware/authMiddleware");


router.get("/", authMiddleware, async (req, res, next) => {
    try{
        const users = await User.find().select("-password")
        .populate("role", "name");

        res.status(200).json({
            success: true, users,
            count: users.length
        
        });
    } catch(err){
        next(err);
    }
});
module.exports = router;