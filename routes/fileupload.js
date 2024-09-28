const express = require("express");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Queue } = require("bullmq");
//updated
//updated for
//

const router = express.Router();
const filesDir = path.join("/home/admin1/Metagenome_tool/example");


const metadataDir = path.join(__dirname, "metadata");

if (!fs.existsSync(metadataDir)) {
  fs.mkdirSync(metadataDir);
}

if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir, { recursive: true });
}

// Multer Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "filesDir"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

const analysisQueue = new Queue("analysisQueue");

router.post("/", upload.array("files", 2), async (req, res) => {
  try {
    if (!req.files || req.files.length !== 2) {
      return res.status(400).json({ message: "Two files are required" });
    }

    // Check if form data is provided
    const { jobName, email } = req.body;
    if (!jobName || !email) {
      return res.status(400).json({ message: "Job name and email are required." });
    }

    const jobId = crypto.randomBytes(20).toString("hex");

    const filePaths = req.files.map((file, index) => {
      const newFileName = `${jobId}_${index + 1}${path.extname(file.originalname)}`;
      const newFilePath = path.join(filesDir, newFileName);
      fs.renameSync(file.path, newFilePath);  // Move the file to the desired location
      return newFilePath;
    });

    // Save metadata with the job info and file paths
    const metadata = {
      jobId,
      jobName,
      email,
      filePaths,
      uploadTime: new Date().toISOString(),
    };

    const metadataPath = path.join(metadataDir, `${jobId}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // Respond with success
    res.status(200).json({ message: "Files uploaded successfully", jobId });
  } catch (error) {
    console.error("Error processing files:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/start-analysis/:jobId", async (req, res) => {
  const { jobId } = req.params;

  const metadataPath = path.join(metadataDir, `${jobId}.json`);

  if (!fs.existsSync(metadataPath)) {
    return res.status(404).json({ message: "Job not found." });
  }

  const jobData = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

  const { filePaths } = jobData;

  await analysisQueue.add("startAnalysis", {
    jobId: jobData.jobId,
    filePaths: filePaths,
    removeOnComplete: true,
    removeOnFail: 1000,
  });
  const counts = await analysisQueue.getJobCounts(
    "wait",
    "completed",
    "failed",
    "active"
  );

  res.status(200).json({
    message: "Analysis job added to the queue.",
    jobCounts: {
      waiting: counts.wait,
      completed: counts.completed,
      failed: counts.failed,
      active: counts.active,
    },
  });
});






module.exports = router;
