const express = require("express");
const { Storage } = require("@google-cloud/storage");

const app = express();

const PORT = process.env.PORT || 8080;

const storage = new Storage();

app.get("/", (req, res) => {
    res.send("Prouto Population Server Running 🚀");
});

app.get("/api/test", async (req, res) => {

    try {

        const bucket = storage.bucket("prouto-population-data");

        const [files] = await bucket.getFiles();

        res.json({
            success: true,
            totalFiles: files.length,
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message,
        });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Running on ${PORT}`);
});