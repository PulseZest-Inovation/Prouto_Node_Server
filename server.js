const express = require("express");

const app = express();

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
    res.send("Prouto Population Server Running 🚀");
});

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "API working 🚀"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Running on ${PORT}`);
});
