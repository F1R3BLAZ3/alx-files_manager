import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}`;

    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.database = database;
    this.db = null;

    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('MongoDB connected successfully');
      this.db = this.client.db(this.database);
    } catch (error) {
      console.error('MongoDB connection error:', error);
    }
  }

  isAlive() {
    return this.client.topology?.isConnected() ?? false;
  }

  async nbUsers() {
    if (!this.db) {
      await this.connect();
    }
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    if (!this.db) {
      await this.connect();
    }
    return this.db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
