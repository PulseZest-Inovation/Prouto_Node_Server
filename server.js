const express = require("express");
const GeoTIFF = require("geotiff");

const app = express();

const PORT = process.env.PORT || 8080;

/**
 * Public GeoTIFF URL
 * (Cloud Storage File URL)
 */
const FILE_URL =
  "https://storage.googleapis.com/prouto-population-data/ind_ppp_2020.tif";

/**
 * Cache TIFF Image
 */
let image = null;

/**
 * Load GeoTIFF ONLY ONCE
 */
async function loadGeoTiff() {
  try {
    if (image) return image;

    console.log("Loading GeoTIFF...");

    const tiff = await GeoTIFF.fromUrl(FILE_URL);

    image = await tiff.getImage();

    console.log("GeoTIFF loaded successfully ✅");

    return image;
  } catch (error) {
    console.error("Error loading TIFF:", error);
    throw error;
  }
}

/**
 * Get Population From Coordinates
 */
async function getPopulation(lat, lng) {
  try {
    const img = await loadGeoTiff();

    const bbox = img.getBoundingBox();

    const width = img.getWidth();
    const height = img.getHeight();

    const [minX, minY, maxX, maxY] = bbox;

    /**
     * Convert lat/lng to pixel coordinates
     */
    const x = Math.floor(
      ((lng - minX) / (maxX - minX)) * width
    );

    const y = Math.floor(
      ((maxY - lat) / (maxY - minY)) * height
    );

    /**
     * Out of bounds
     */
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return 0;
    }

    /**
     * Read ONLY ONE PIXEL
     * HUGE MEMORY OPTIMIZATION 🚀
     */
    const raster = await img.readRasters({
      window: [x, y, x + 1, y + 1],
    });

    const population = raster?.[0]?.[0] || 0;

    return Number(population.toFixed(3));

  } catch (error) {
    console.error("Population Error:", error);
    return 0;
  }
}

/**
 * Root Route
 */
app.get("/", (req, res) => {
  res.send("Prouto Population Server Running 🚀");
});

/**
 * Health Check
 */
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API Working 🚀",
  });
});

/**
 * Population API
 */
app.get("/api/get-population", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    /**
     * Validation
     */
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: "lat and lng required",
      });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: "Invalid coordinates",
      });
    }

    /**
     * Fetch Population
     */
    const population = await getPopulation(
      latitude,
      longitude
    );

    res.json({
      success: true,
      lat: latitude,
      lng: longitude,
      populationDensity: population,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * Start Server
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
