const express = require("express");
const GeoTIFF = require("geotiff");

const app = express();

const PORT = process.env.PORT || 8080;

/**
 * Public URL of TIFF file
 * Make sure file is public in GCS
 */
const fileUrl =
    "https://storage.googleapis.com/prouto-population-data/ind_ppp_2020.tif";

let image = null;

/**
 * Population Cache
 */
const populationCache = {};

/**
 * Load GeoTIFF WITHOUT downloading full file
 */
async function loadGeoTiff() {

    if (image) return image;

    console.log("Loading GeoTIFF from URL...");

    /**
     * Streams data using HTTP range requests
     * instead of downloading full 2GB file
     */
    const tiff = await GeoTIFF.fromUrl(fileUrl);

    image = await tiff.getImage();

    console.log("GeoTIFF loaded successfully");

    return image;
}

/**
 * Get Population
 */
async function getPopulation(lat, lng) {

    /**
     * Reduce precision for better caching
     */
    const roundedLat = Number(lat).toFixed(2);
    const roundedLng = Number(lng).toFixed(2);

    const cacheKey =
        `${roundedLat}_${roundedLng}`;

    /**
     * Return cache if exists
     */
    if (populationCache[cacheKey] !== undefined) {
        return populationCache[cacheKey];
    }

    const img = await loadGeoTiff();

    const bbox = img.getBoundingBox();

    const width = img.getWidth();
    const height = img.getHeight();

    const [minX, minY, maxX, maxY] = bbox;

    const x = Math.floor(
        ((Number(lng) - minX) / (maxX - minX)) * width
    );

    const y = Math.floor(
        ((maxY - Number(lat)) / (maxY - minY)) * height
    );

    /**
     * Outside India bounds
     */
    if (x < 0 || y < 0 || x >= width || y >= height) {

        populationCache[cacheKey] = 0;

        return 0;
    }

    /**
     * Read ONLY tiny raster window
     */
    const raster = await img.readRasters({
        window: [x, y, x + 1, y + 1],
    });

    const population =
        Number((raster?.[0]?.[0] || 0).toFixed(3));

    /**
     * Save cache
     */
    populationCache[cacheKey] = population;

    return population;
}

/**
 * Root Route
 */
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

        const population = await getPopulation(
            Number(lat),
            Number(lng)
        );

        res.json({
            lat: Number(lat),
            lng: Number(lng),
            population,
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message,
        });
    }
});

/**
 * Start Server
 */
app.listen(PORT, "0.0.0.0", () => {

    console.log(`Running on ${PORT}`);

    /**
     * Warm TIFF cache after startup
     */
    setTimeout(() => {

        loadGeoTiff()
            .then(() => {
                console.log("TIFF preloaded 🚀");
            })
            .catch(console.error);

    }, 3000);
});