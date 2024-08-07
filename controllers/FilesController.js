import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db.js';
import redisClient from '../utils/redis.js';
import fs from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';

const FILE_STORAGE_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

if (!fs.existsSync(FILE_STORAGE_PATH)) {
  fs.mkdirSync(FILE_STORAGE_PATH, { recursive: true });
}

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, type, parentId = 0, isPublic = false, data } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }
      if (!type || !['folder', 'file', 'image'].includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }
      if (type !== 'folder' && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }

      if (parentId !== 0) {
        const parentFile = await dbClient.db.collection('files').findOne({ _id: new ObjectId(parentId) });
        if (!parentFile) {
          return res.status(400).json({ error: 'Parent not found' });
        }
        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      let localPath = null;
      if (type !== 'folder') {
        const fileName = uuidv4();
        localPath = path.join(FILE_STORAGE_PATH, fileName);
        const fileData = Buffer.from(data, 'base64');
        fs.writeFileSync(localPath, fileData);
      }

      const newFile = {
        userId: new ObjectId(userId),
        name,
        type,
        isPublic,
        parentId: new ObjectId(parentId),
        localPath
      };

      const result = await dbClient.db.collection('files').insertOne(newFile);
      newFile.id = result.insertedId.toString();
      res.status(201).json(newFile);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default FilesController;
