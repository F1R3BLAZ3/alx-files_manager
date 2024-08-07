import dbClient from '../utils/db.js';  // Adjust the path as necessary
import redisClient from '../utils/redis.js';  // Adjust the path as necessary

const AppController = {
    // GET /status
    getStatus: async (req, res) => {
        try {
            const redisAlive = redisClient.isAlive();
            const dbAlive = dbClient.isAlive();
            res.status(200).json({ redis: redisAlive, db: dbAlive });
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    // GET /stats
    getStats: async (req, res) => {
        try {
            const users = await dbClient.nbUsers();
            const files = await dbClient.nbFiles();
            res.status(200).json({ users, files });
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};

export default AppController;
