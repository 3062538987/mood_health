import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  checkAchievementsHandler,
  getAchievementProgressHandler,
  getAchievementsHandler,
  getUserAchievementsHandler,
} from "../controllers/achievementController";

const router = Router();

router.get("/", getAchievementsHandler);
router.get("/user", authenticate, getUserAchievementsHandler);
router.post("/check", authenticate, checkAchievementsHandler);
router.get("/progress", authenticate, getAchievementProgressHandler);

export default router;
