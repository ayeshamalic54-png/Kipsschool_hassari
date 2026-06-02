import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import studentsRouter from "./students";
import classesRouter from "./classes";
import feesRouter from "./fees";
import attendanceRouter from "./attendance";
import examsRouter from "./exams";
import staffRouter from "./staff";
import salariesRouter from "./salaries";
import accountsRouter from "./accounts";
import certificatesRouter from "./certificates";
import adminRouter from "./admin";
import feeStructureRouter from "./fee-structure";
import settingsRouter from "./settings";
import feeVouchersRouter from "./fee-vouchers";   // ← NEW
import arrearsRouter from "./arrears";             // ← NEW

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/dashboard", dashboardRouter);
router.use("/students", studentsRouter);
router.use("/classes", classesRouter);
router.use("/fees", feesRouter);
router.use("/attendance", attendanceRouter);
router.use("/exams", examsRouter);
router.use("/staff", staffRouter);
router.use("/salaries", salariesRouter);
router.use("/accounts", accountsRouter);
router.use("/certificates", certificatesRouter);
router.use("/admin", adminRouter);
router.use("/fee-structures", feeStructureRouter);
router.use("/settings", settingsRouter);
router.use("/fee-vouchers", feeVouchersRouter);   // ← NEW
router.use("/arrears", arrearsRouter);             // ← NEW

export default router;
