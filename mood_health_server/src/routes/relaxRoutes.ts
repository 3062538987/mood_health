import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getRelaxRecordDetailHandler,
  getRelaxRecordsHandler,
  getRelaxStatisticsHandler,
  saveRelaxRecordHandler,
} from "../controllers/relaxController";

const router = Router();

router.use(authenticate);
router.get("/records", getRelaxRecordsHandler);
router.post("/records", saveRelaxRecordHandler);
router.get("/records/:id", getRelaxRecordDetailHandler);
router.get("/statistics", getRelaxStatisticsHandler);

export default router;
