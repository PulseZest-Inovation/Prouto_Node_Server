const express = require("express");
const GeoTIFF = require("geotiff");

const app = express();

const PORT = process.env.PORT || 8080;

/**
 * GeoTIFF File URL
 */
const FILE_URL =
  "https://storage.googleapis.com/prouto-population-data/ind_ppp_2020.tif";

/**
 * Cache image
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

    /**
     * First image layer
     */
    image = await tiff.getImage(0);

    console.log("GeoTIFF Loaded Successfully ✅");

    console.log("Width:", image.getWidth());
    console.log("Height:", image.getHeight());
    console.log("BBox:", image.getBoundingBox());

    return image;

  } catch (error) {
    console.error("TIFF Load Error:", error);
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
     * Convert lat/lng → pixel coordinates
     */
    const x = Math.floor(
      ((lng - minX) / (maxX - minX)) * width
    );

    /**
     * FIXED Y CALCULATION ✅
     */
    const y = Math.floor(
      ((lat - minY) / (maxY - minY)) * height
    );

    console.log({
      lat,
      lng,
      x,
      y,
      width,
      height,
      bbox,
    });

    /**
     * Out of bounds
     */
    if (
      x < 0 ||
      y < 0 ||
      x >= width ||
      y >= height
    ) {
      console.log("Out of bounds");

      return 0;
    }

    /**
     * Read ONLY ONE PIXEL
     */
    const raster = await img.readRasters({
      window: [x, y, x + 1, y + 1],
    });

    console.log("Raster:", raster);

    const value = raster?.[0]?.[0];

    console.log("Pixel Value:", value);

    /**
     * Invalid values
     */
    if (
      value === undefined ||
      value === null ||
      value < 0
    ) {
      return 0;
    }

    return Number(value.toFixed(3));

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

    if (
      isNaN(latitude) ||
      isNaN(longitude)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid coordinates",
      });
    }

    /**
     * Get Population
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

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Start Server
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
