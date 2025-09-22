const express = require('express');
const path = require('path');
const { addObject } = require('./object-manage/object-manager');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Route for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST route for adding objects
app.post('/add/:number', (req, res) => {
    try {
        const objectId = req.params.number;
        const result = addObject(objectId);
        
        if (result.success) {
            let message = '';
            if (result.removedObject) {
                if (result.removedObject.reason === 'duplicate') {
                    message = `Removed duplicate object ${result.removedObject.id} (${result.removedObject.name}) from ${result.removedObject.location}, then added object ${result.addedObject.id} (${result.addedObject.name}) at ${result.addedObject.location}`;
                } else if (result.removedObject.reason === 'oldest') {
                    message = `Garden full! Removed oldest object ${result.removedObject.id} (${result.removedObject.name}) from ${result.removedObject.location}, then added object ${result.addedObject.id} (${result.addedObject.name}) at ${result.addedObject.location}`;
                } else if (result.removedObject.reason === 'forced_displacement') {
                    message = `No available locations! Forcibly displaced object ${result.removedObject.id} (${result.removedObject.name}) from ${result.removedObject.location}, then added object ${result.addedObject.id} (${result.addedObject.name}) at ${result.addedObject.location}`;
                }
            } else {
                message = `Added object ${result.addedObject.id} (${result.addedObject.name}) at ${result.addedObject.location}`;
            }
            
            res.json({
                success: true,
                message: message,
                removedObject: result.removedObject,
                addedObject: result.addedObject,
                gardenState: result.gardenState
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error: ' + error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
