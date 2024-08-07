#!/usr/bin/env node

import express from 'express';
import routes from './routes/index.js';


// Create an Express application
const app = express();

// Get the port from the environment or default to 5000
const port = process.env.PORT || 5000;

// Load routes
app.use(express.json());
app.use('/', routes);

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
