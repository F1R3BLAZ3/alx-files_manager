import crypto from 'crypto';
import dbClient from '../utils/db.js';

const UsersController = {
    postNew: async (req, res) => {
        const { email, password } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Missing email' });
        }
        if (!password) {
            return res.status(400).json({ error: 'Missing password' });
        }

        try {
            const existingUser = await dbClient.db.collection('users').findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'Already exist' });
            }

            const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

            const result = await dbClient.db.collection('users').insertOne({
                email,
                password: hashedPassword
            });

            const newUser = {
                id: result.insertedId,
                email
            };
            return res.status(201).json(newUser);
        } catch (error) {
            console.error('Error creating user:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};

export default UsersController;
