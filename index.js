const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const argv = require('yargs').argv;
const os = require('os');

const inputRoot = './audio'; // Root folder for input files
const outputRoot = './wav'; // Root folder for WAV files
//const concatMode = argv.concat; // Set to true if `--concat` flag is used
const concatMode = 1;

const numCPUs = os.cpus().length;

// Recursively search for all MP3 and M4V files and group them by their output folders
function getAllMediaFilesGroupedByFolder(dir) {
  let folderMap = {};
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const subFolderMap = getAllMediaFilesGroupedByFolder(fullPath); // Recurse into subdirectory
      for (const [folder, files] of Object.entries(subFolderMap)) {
        if (!folderMap[folder]) {
          folderMap[folder] = [];
        }
        folderMap[folder].push(...files);
      }
    } else if (
      ['.mp3', '.m4v'].includes(path.extname(file).toLowerCase())
    ) {
      const relativePath = path.relative(inputRoot, fullPath);
      const outputFolder = path.join(outputRoot, path.dirname(relativePath));

      if (!folderMap[outputFolder]) {
        folderMap[outputFolder] = [];
      }
      folderMap[outputFolder].push(fullPath);
    }
  });

  return folderMap;
}

// Convert input files to WAV if the WAV file doesn't already exist
function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(outputPath)) {
      console.log(`Skipping (already exists): ${outputPath}`);
      return resolve();
    }

    // Ensure the output directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    // Set up FFmpeg command
    let command = ffmpeg(inputPath);

    // If the input file is an M4V file, extract audio
    if (path.extname(inputPath).toLowerCase() === '.m4v') {
      command = command.noVideo(); // Disable video recording (equivalent to -vn)
    }

    // Convert to WAV
    command
      .output(outputPath)
      .on('end', () => {
        console.log(`Converted: ${inputPath} -> ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`Error converting ${inputPath}:`, err);
        reject(err);
      })
      .run();
  });
}

// Concatenate all WAV files in a folder into a single file
function concatenateWavFiles(folder) {
  return new Promise((resolve, reject) => {
    const wavFiles = fs.readdirSync(folder)
      .filter((file) => path.extname(file) === '.wav')
      .map((file) => path.join(folder, file));

    if (wavFiles.length === 0) return resolve();

    // Get the folder name to use as the output file name
    const folderName = path.basename(folder);
    const concatOutput = path.join(folder, `${folderName}.wav`);

    if (fs.existsSync(concatOutput)) {
      console.log(`Concatenation file already exists: ${concatOutput}`);
    } else {
      const ffmpegCommand = ffmpeg();
      wavFiles.forEach((file) => {
        if (file !== concatOutput) {
          ffmpegCommand.input(file);
        }
      });

      ffmpegCommand
        .on('end', () => {
          console.log(`Concatenated files into: ${concatOutput}`);

          // Delete the individual WAV files after concatenation
          wavFiles.forEach((file) => {
            if (file !== concatOutput) {
              fs.unlinkSync(file);
              console.log(`Deleted: ${file}`);
            }
          });
          resolve();
        })
        .on('error', (err) => {
          console.error(`Error concatenating files in ${folder}:`, err);
          reject(err);
        })
        .mergeToFile(concatOutput);
    }
  });
}

// Custom concurrency limiter
function concurrencyLimit(tasks, limit) {
  return new Promise((resolve, reject) => {
    let index = 0;
    let active = 0;
    let results = [];

    function next() {
      while (active < limit && index < tasks.length) {
        active++;
        const currentIndex = index++;
        tasks[currentIndex]()
          .then((result) => {
            results[currentIndex] = result;
            active--;
            next();
          })
          .catch(reject);
      }
      if (index >= tasks.length && active === 0) {
        resolve(results);
      }
    }
    next();
  });
}

// Main processing function
(async () => {
  try {
    const folderMap = getAllMediaFilesGroupedByFolder(inputRoot);

    // Convert files to WAV in parallel with concurrency limit
    const convertTasks = [];

    for (const [outputFolder, inputFiles] of Object.entries(folderMap)) {
      for (const inputFile of inputFiles) {
        const relativePath = path.relative(inputRoot, inputFile);
        const wavFileName = path.parse(relativePath).name + '.wav';
        const wavFilePath = path.join(outputFolder, wavFileName);

        const convertTask = () => convertToWav(inputFile, wavFilePath);
        convertTasks.push(convertTask);
      }
    }

    await concurrencyLimit(convertTasks, numCPUs);
    console.log('All conversions completed.');

    // Concatenate WAV files in parallel with concurrency limit
    if (concatMode) {
      const concatTasks = [];

      for (const outputFolder of Object.keys(folderMap)) {
        const concatTask = () => concatenateWavFiles(outputFolder);
        concatTasks.push(concatTask);
      }

      await concurrencyLimit(concatTasks, numCPUs);
      console.log('All concatenations completed.');
    }

    console.log('All files processed successfully.');
  } catch (error) {
    console.error('Error during processing:', error);
  }
})();
