import Bull from 'bull';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import dbClient from './utils/db.js';
import { ObjectId } from 'mongodb';

// Create a Bull queue
const fileQueue = new Bull('fileQueue', {
  redis: { port: 6379, host: 'localhost' }
});

// Process the queue
fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }

  const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId), userId: new ObjectId(userId) });
  if (!file) {
    throw new Error('File not found');
  }

  if (file.type !== 'image') {
    throw new Error('File is not an image');
  }

  const filePath = path.join(process.env.FOLDER_PATH || '/tmp/files_manager', fileId);
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found');
  }

  const sizes = [100, 250, 500];
  for (const size of sizes) {
    const outputFilePath = `${filePath}_${size}`;
    try {
      await sharp(filePath).resize(size).toFile(outputFilePath);
    } catch (err) {
      console.error(`Error processing image with size ${size}:`, err);
    }
  }
});

fileQueue.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

fileQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error ${err.message}`);
});

console.log('Worker started');
