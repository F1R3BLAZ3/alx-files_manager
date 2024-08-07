import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db.js';
import redisClient from '../utils/redis.js';
import fs from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import mime from 'mime-types'; // Import mime-types

const FILE_STORAGE_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

if (!fs.existsSync(FILE_STORAGE_PATH)) {
  fs.mkdirSync(FILE_STORAGE_PATH, { recursive: true });
}

class FilesController {
  // Upload a file
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

  // Retrieve a file document by ID
  static async getShow(req, res) {
    const { id } = req.params;
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      res.status(200).json(file);
    } catch (error) {
      console.error('Error retrieving file:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Retrieve all files with pagination and optional parentId
  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    const { parentId = 0, page = 0 } = req.query;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = 20; // Maximum items per page
      const skip = parseInt(page, 10) * limit;

      const files = await dbClient.db.collection('files')
        .find({ userId: new ObjectId(userId), parentId: new ObjectId(parentId) })
        .skip(skip)
        .limit(limit)
        .toArray();

      res.status(200).json(files);
    } catch (error) {
      console.error('Error retrieving files:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Publish a file
  static async putPublish(req, res) {
    const { id } = req.params;
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await dbClient.db.collection('files').findOneAndUpdate(
        { _id: new ObjectId(id), userId: new ObjectId(userId) },
        { $set: { isPublic: true } },
        { returnOriginal: false }
      );

      if (!result.value) {
        return res.status(404).json({ error: 'Not found' });
      }

      res.status(200).json(result.value);
    } catch (error) {
      console.error('Error publishing file:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Unpublish a file
  static async putUnpublish(req, res) {
    const { id } = req.params;
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await dbClient.db.collection('files').findOneAndUpdate(
        { _id: new ObjectId(id), userId: new ObjectId(userId) },
        { $set: { isPublic: false } },
        { returnOriginal: false }
      );

      if (!result.value) {
        return res.status(404).json({ error: 'Not found' });
      }

      res.status(200).json(result.value);
    } catch (error) {
      console.error('Error unpublishing file:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Retrieve file content
  static async getFile(req, res) {
    const { id } = req.params;
    const token = req.headers['x-token'];

    try {
      const userId = token ? await redisClient.get(`auth_${token}`) : null;
      const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(id) });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (file.type === 'folder') {
        return res.status(400).json({ error: 'A folder doesn\'t have content' });
      }

      if (file.localPath && fs.existsSync(file.localPath)) {
        const mimeType = mime.lookup(file.name) || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);
        const fileData = fs.readFileSync(file.localPath);
        res.status(200).send(fileData);
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    } catch (error) {
      console.error('Error retrieving file content:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default FilesController;
