const express = require("express");
const GeoTIFF = require("geotiff");

const app = express();

const PORT = process.env.PORT || 8080;

/**
 * Public TIFF URL
 */
const fileUrl =
    "https://storage.googleapis.com/prouto-population-data/ind_ppp_2020_cog.tif";

/**
 * TIFF + Cache
 */
let image = null;
let loadingPromise = null;

/**
 * Population cache
 */
const populationCache = new Map();

/**
 * Load TIFF once
 */
async function loadGeoTiff() {

    if (image) {
        return image;
    }

    /**
     * Prevent multiple simultaneous loads
     */
    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = (async () => {

        console.log("Loading GeoTIFF from URL...");

        const tiff = await GeoTIFF.fromUrl(fileUrl);

        image = await tiff.getImage();

        console.log("GeoTIFF loaded successfully 🚀");

        return image;

    })();

    return loadingPromise;
}

/**
 * Get Population
 */
async function getPopulation(lat, lng) {

    /**
     * Reduced precision
     * better cache hit rate
     */
    const roundedLat =
        Number(lat).toFixed(2);

    const roundedLng =
        Number(lng).toFixed(2);

    const cacheKey =
        `${roundedLat}_${roundedLng}`;

    /**
     * Return from cache
     */
    if (populationCache.has(cacheKey)) {

        return populationCache.get(cacheKey);
    }

    const img = await loadGeoTiff();

    const bbox = img.getBoundingBox();

    const width = img.getWidth();
    const height = img.getHeight();

    const [minX, minY, maxX, maxY] = bbox;

    /**
     * Convert lat/lng → pixel
     */
    const x = Math.floor(
        ((Number(lng) - minX) /
            (maxX - minX)) * width
    );

    const y = Math.floor(
        ((maxY - Number(lat)) /
            (maxY - minY)) * height
    );

    /**
     * Outside raster
     */
    if (
        x < 0 ||
        y < 0 ||
        x >= width ||
        y >= height
    ) {

        populationCache.set(cacheKey, 0);

        return 0;
    }

    /**
     * Read tiny raster window
     */
    const raster = await img.readRasters({
        window: [x, y, x + 1, y + 1],
        width: 1,
        height: 1,
        interleave: true,
    });

    const population =
        Number(
            (raster?.[0] || 0).toFixed(3)
        );

    /**
     * Save cache
     */
    populationCache.set(
        cacheKey,
        population
    );

    /**
     * Prevent memory explosion
     */
    if (populationCache.size > 50000) {

        const firstKey =
            populationCache.keys().next().value;

        populationCache.delete(firstKey);
    }

    return population;
}

/**
 * Root
 */
app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "API working 🚀",
    });
});

/**
 * Health Check
 */
app.get("/health", (req, res) => {

    res.status(200).send("OK");
});

/**
 * Population API
 */
app.get(
    "/api/get-population",
    async (req, res) => {

        try {

            const { lat, lng } = req.query;

            if (!lat || !lng) {

                return res.status(400).json({
                    error: "lat and lng required",
                });
            }

            const population =
                await getPopulation(
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
    }
);

/**
 * Start Server
 */
app.listen(PORT, "0.0.0.0", async () => {

    console.log(`Running on ${PORT}`);

    /**
     * Preload TIFF
     */
    try {

        await loadGeoTiff();

        console.log(
            "TIFF preloaded successfully 🚀"
        );

    } catch (err) {

        console.error(
            "TIFF preload failed:",
            err
        );
    }
});
