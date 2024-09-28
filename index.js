const express = require('express')
const cors = require('cors');
const fileRoute = require('./routes/fileupload')

const app = express()
app.use(cors({ origin: '*' }));

app.use("/api/fileupload", fileRoute)
app.get('/', (req, res) => {
    res.send('Hello, World!'); // This will be shown when you access the root URL
  });

app.listen(8000, '0.0.0.0', () => {
    console.log("Server is running...");
})

