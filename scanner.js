import axios from "axios";

const ZAP_URL = "http://localhost:8080";
const API_KEY = "";

export async function runScan(targetUrl) {
  console.log(`Starting scan of: ${targetUrl}\n`);

  try {
    // Validate URL format
    try {
      new URL(targetUrl);
    } catch (error) {
      return {
        success: false,
        error: "Invalid URL format. Please include http:// or https://",
      };
    }

    // 0. Clear previous session data (prevents accumulating results)
    console.log("0. Creating fresh session...");
    try {
      await axios.get(`${ZAP_URL}/JSON/core/action/newSession/`, {
        params: {
          apikey: API_KEY,
          name: `scan-${Date.now()}`,
          overwrite: true,
        },
        timeout: 10000,
      });
      console.log("   Fresh session created");
    } catch (sessionError) {
      console.log("   Session warning:", sessionError.message);
    }

    // 1. Access the site first (so ZAP can see it)
    console.log("1. Accessing target URL...");
    await axios.get(`${ZAP_URL}/JSON/core/action/accessUrl/`, {
      params: {
        apikey: API_KEY,
        url: targetUrl,
      },
      timeout: 30000,
    });

    // 2. Run spider with limits to prevent infinite crawling
    console.log("2. Spidering website...");
    const spiderRes = await axios.get(`${ZAP_URL}/JSON/spider/action/scan/`, {
      params: {
        apikey: API_KEY,
        url: targetUrl,
        maxChildren: 10, // Limit pages to crawl
        maxDepth: 5, // Limit crawl depth
        maxDuration: 60, // Max 60 seconds for spidering
      },
      timeout: 30000,
    });

    const spiderId = spiderRes.data.scan;
    console.log(`   Spider ID: ${spiderId}`);

    // 3. Wait for spider to complete (with timeout)
    let spiderComplete = false;
    let spiderAttempts = 0;
    const maxSpiderAttempts = 30; // 30 * 2 seconds = 60 seconds max

    while (!spiderComplete && spiderAttempts < maxSpiderAttempts) {
      const statusRes = await axios.get(`${ZAP_URL}/JSON/spider/view/status/`, {
        params: { apikey: API_KEY, scanId: spiderId },
        timeout: 10000,
      });
      const progress = parseInt(statusRes.data.status);
      console.log(`   Spider progress: ${progress}%`);

      if (progress >= 100) {
        spiderComplete = true;
      } else {
        spiderAttempts++;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!spiderComplete) {
      console.log("   Spider timed out, stopping...");
      await axios.get(`${ZAP_URL}/JSON/spider/action/stop/`, {
        params: { apikey: API_KEY, scanId: spiderId },
      });
    }

    // 4. Get passive scan results
    console.log("\n3. Collecting results...");
    const alertsRes = await axios.get(`${ZAP_URL}/JSON/core/view/alerts/`, {
      params: {
        apikey: API_KEY,
        baseurl: targetUrl,
      },
      timeout: 30000,
    });

    const alerts = alertsRes.data.alerts || [];
    const alertCount = alerts.length;

    if (alertCount === 0) {
      console.log("\n✅ No issues found!");
    } else {
      console.log(`\n📊 Found ${alertCount} issue(s):\n`);
      alerts.forEach((alert, index) => {
        console.log(`${index + 1}. ${alert.name}`);
        console.log(`   Risk Level: ${alert.risk}`);
        if (alert.url) console.log(`   URL: ${alert.url}`);
        console.log("");
      });
    }

    return {
      success: true,
      url: targetUrl,
      alertCount: alertCount,
      alerts: alerts.map((alert) => ({
        name: alert.name,
        risk: alert.risk,
        description: alert.description || "No description available",
        solution: alert.solution || "No solution provided",
        url: alert.url || targetUrl,
        parameter: alert.parameter || "",
        evidence: alert.evidence || "",
        cweId: alert.cweid || null,
        wascId: alert.wascid || null,
      })),
    };
  } catch (error) {
    console.error("Scan failed:", error.message);

    if (error.code === "ECONNREFUSED") {
      return {
        success: false,
        error:
          "Cannot connect to ZAP. Please make sure ZAP is running on port 8080",
      };
    } else if (error.code === "ETIMEDOUT") {
      return {
        success: false,
        error: "Scan timed out. The target website may be slow or unresponsive",
      };
    } else if (error.response) {
      return {
        success: false,
        error: `ZAP API error: ${error.response.data?.message || error.response.statusText || "Unknown error"}`,
      };
    } else {
      return {
        success: false,
        error: error.message || "An unexpected error occurred during the scan",
      };
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2];
  if (!target) {
    console.log("Usage: node scanner.js <target-url>");
    console.log("Example: node scanner.js https://juice-shop.herokuapp.com");
    process.exit(1);
  }

  runScan(target)
    .then((result) => {
      if (!result.success) {
        console.error("Error:", result.error);
        process.exit(1);
      }
      console.log("\n✅ Scan completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Fatal error:", error.message);
      process.exit(1);
    });
}
