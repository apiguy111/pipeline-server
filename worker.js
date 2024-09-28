const { Worker, Queue } = require("bullmq");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const archiver = require("archiver");
//updated

const resultsDir = path.join(__dirname, "results");

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir);
}

const redisConfig = {
  host: "localhost",
  port: 6379,
};

const analysisQueue = new Queue("analysisQueue", {
  connection: redisConfig,
});

const analysisWorker = new Worker(
  "analysisQueue",
  async (job) => {
    const { jobId, filePaths } = job.data;

    if (filePaths.length !== 2) {
      throw new Error(`Expected 2 files, but got ${filePaths.length}.`);
    }

    filePaths.forEach((filePath) => {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
    });

    const scriptPath = "/home/admin1/Metagenome_tool/Metagenome";

    await runScript(scriptPath, filePaths[0], filePaths[1]);

    const zipFilePath = path.join(resultsDir, `${jobId}.zip`);
    // await zipResults(jobId, zipFilePath);

    console.log(`Job ${jobId} completed and results saved to ${zipFilePath}`);
  },
  {
    connection: redisConfig,
    lockDuration: 1800000,
    timeout: 1800000,
  }
);

function runScript(scriptPath, file1, file2) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(file1) || !fs.existsSync(file2)) {
      return reject(
        new Error(`One or both input files do not exist: ${file1}, ${file2}`)
      );
    }

    // try {
    //   fs.accessSync(file1, fs.constants.R_OK);
    //   fs.accessSync(file2, fs.constants.R_OK);
    // } catch (err) {
    //   return reject(
    //     new Error(`One or both files are not readable: ${file1}, ${file2}`)
    //   );
    // }

    const fileName1 = path.basename(file1);
    const fileName2 = path.basename(file2);

    const command = `${scriptPath} ${fileName1} ${fileName2}`;
    console.log(`Executing command: ${command}`);
    const workingDir = path.dirname(file1);
    const commandAsRoot = `sudo ${command}`;

    exec(commandAsRoot, { cwd: workingDir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing script: ${stderr}`);
        return reject(error);
      }

      if (stdout.includes("Error reading file")) {
        return reject(new Error(`Error reading files in script: ${stdout}`));
      }

      console.log(`Script output: ${stdout}`);
      resolve(stdout);
    });
  });
}

function zipResults(jobId, zipFilePath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`${archive.pointer()} total bytes written to ${zipFilePath}`);
      resolve();
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);

    const analysisOutputDir = path.join(__dirname, "analysis-output", jobId);
    archive.directory(analysisOutputDir, false);

    archive.finalize();
  });
}


//

// analysisWorker.on("active", (job) => {
//   console.log(`Job ${job.id} is now active and processing...`);

//   // Log job status every 2 minutes (120000 ms)
//   jobIntervals[job.id] = setInterval(() => {
//     console.log(`Job ${job.id} is still processing...`);
//   }, 60000);
// });

// analysisWorker.on("completed", (job) => {
//   console.log(`Job ${job.id} has completed.`);

//   if (jobIntervals[job.id]) {
//     clearInterval(jobIntervals[job.id]);
//     delete jobIntervals[job.id];
//   }
// });

// analysisWorker.on("failed", (job, err) => {
//   console.error(`Job ${job.id} failed with error: ${err.message}`);

//   if (jobIntervals[job.id]) {
//     clearInterval(jobIntervals[job.id]);
//     delete jobIntervals[job.id];
//   }
// });

// async function clearAllJobs() {
//   try {
//     await analysisQueue.obliterate({ force: true });
//     console.log("All jobs have been cleared from the queue.");
//   } catch (error) {
//     console.error("Error clearing jobs from queue:", error);
//   }
// }

// clearAllJobs();

// async function getJobStatus(jobId) {
//   try {
//     const job = await analysisQueue.getJob(jobId);

//     if (!job) {
//       console.log(`Job with ID ${jobId} not found.`);
//       return;
//     }

//     const state = await job.getState();
//     const progress = job.progress;
//     const result = job.returnvalue;

//     console.log(`Job ${jobId} is currently ${state}.`);
//     if (state === "completed") {
//       console.log(`Job result: ${result}`);
//     } else if (state === "failed") {
//       console.log(`Job failed with reason: ${job.failedReason}`);
//     }

//     console.log(`Job progress: ${progress}%`);
//   } catch (error) {
//     console.error("Error fetching job status:", error);
//   }
// }

// getJobStatus(1);
