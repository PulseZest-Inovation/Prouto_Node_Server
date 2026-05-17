const express = require("express");
const fs = require("fs");
const path = require("path");
const GeoTIFF = require("geotiff");

const app = express();
const PORT = process.env.PORT || 8080;

let image = null;

/**
 * Load GeoTIFF once
 */
async function loadGeoTiff() {
    if (image) return image;

    const filePath = path.join(__dirname, "data", "ind_ppp_2020.tif");

    const buffer = fs.readFileSync(filePath);

    const tiff = await GeoTIFF.fromArrayBuffer(buffer.buffer);

    image = await tiff.getImage();

    console.log("GeoTIFF loaded successfully");

    return image;
}

/**
 * Get population from lat/lng
 */
async function getPopulation(lat, lng) {
    const img = await loadGeoTiff();

    const bbox = img.getBoundingBox();
    const width = img.getWidth();
    const height = img.getHeight();

    const [minX, minY, maxX, maxY] = bbox;

    const x = Math.floor(((lng - minX) / (maxX - minX)) * width);
    const y = Math.floor(((maxY - lat) / (maxY - minY)) * height);

    if (x < 0 || y < 0 || x >= width || y >= height) {
        return 0;
    }

    const raster = await img.readRasters({
        window: [x, y, x + 1, y + 1],
    });

    const population = raster?.[0]?.[0] || 0;

    return Number(population.toFixed(3));
}

/**
 * Root route
 */// routes
app.get("/", (req, res) => {
    res.send("Prouto Population Server Running 🚀");
});

/**
 * Population API
 */
app.get("/api/get-population", async (req, res) => {
    try {
        const { lat, lng } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                error: "lat and lng required",
            });
        }

        const population = await getPopulation(Number(lat), Number(lng));

        res.json({
            lat: Number(lat),
            lng: Number(lng),
            population,
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: "Population lookup failed",
        });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Population server running on port ${PORT}`);
});
