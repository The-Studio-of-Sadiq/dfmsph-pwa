import express from "express";
import path from "path";
import fs from "fs";
import { runDFMSPHCalculation, PRESET_REACTIONS } from "../src/physics/dfmsphEngine.js";
import { executeNativeDFMSPH, isNativeEngineAvailable } from "../src/physics/nativeRunner.js";
import type { CalculationInput } from "../src/types/dfmsph.js";

/* API routes shared by the local/Render server (server.ts) and the Vercel function (api/index.ts) */
export const app = express();

app.use(express.json({ limit: "1mb" }));

/* Health Check API */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    program: "DFMSPH22",
    description: "Double Folding Interaction Potential for Spherical Nuclei",
    version: "2022.1",
    timestamp: new Date().toISOString()
  });
});

/* C Engine Status (DFMSPH22 C sources compiled to WebAssembly) */
app.get("/api/engine-status", (req, res) => {
  const available = isNativeEngineAvailable();
  res.json({
    cEngineAvailable: available,
    binaryExists: available,
    gccAvailable: false,
    engine: "wasm32-wasi"
  });
});

/* Get Preset Reaction Systems */
app.get("/api/presets", (req, res) => {
  res.json(PRESET_REACTIONS);
});

/* Calculate Double Folding Interaction Potential */
app.post("/api/calculate", async (req, res) => {
  try {
    const { input, engine } = req.body;
    const calcInput: CalculationInput = input || req.body;

    if (!calcInput || !calcInput.proj || !calcInput.targ) {
      return res.status(400).json({ error: "Invalid calculation input structure" });
    }

    if (engine === 'ts' || engine === 'js') {
      const tsResult = runDFMSPHCalculation(calcInput);
      const note = "[JS/TS Engine Active] Calculated using JavaScript/TypeScript simulation engine (dfmsphEngine.ts).";
      return res.json({ ...tsResult, isNativeExecution: false, cLogText: note, executionLog: note });
    }

    const { output, isNative, log } = await executeNativeDFMSPH(calcInput);
    return res.json({ ...output, isNativeExecution: isNative, cLogText: log, executionLog: log });
  } catch (err: any) {
    console.error("Calculation Error:", err);
    return res.status(500).json({ error: err.message || "Failed to execute DFMSPH22 calculation" });
  }
});

/* Get Original C Code & Header Files */
app.get("/api/c-code", (req, res) => {
  try {
    const requestedFile = (req.query.file as string) || "dfmsph22.c";
    /* Only the C sources in the project root, no directory traversal */
    const safeFilename = path.basename(requestedFile);
    if (!/\.(c|h)$/.test(safeFilename)) {
      return res.status(400).send(`// Only .c and .h files can be viewed`);
    }
    const cFilePath = path.join(process.cwd(), safeFilename);

    if (fs.existsSync(cFilePath)) {
      res.setHeader("Content-Type", "text/plain");
      return res.send(fs.readFileSync(cFilePath, "utf-8"));
    }
    return res.status(404).send(`// File ${safeFilename} not found`);
  } catch (err: any) {
    return res.status(500).send(`// Error reading C file: ${err.message}`);
  }
});

/* Export formatted calculation data */
app.post("/api/export", async (req, res) => {
  try {
    const { format, input } = req.body;
    const { output: result } = await executeNativeDFMSPH(input);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="dfmsph22_${result.systemName.replace(/[^a-zA-Z0-9]/g, "_")}.csv"`);

      let csv = "R_fm,V_DF_MeV,V_C_MeV,V_Cent_MeV,V_Tot_MeV,V_WS_fit_MeV\n";
      result.radialData.forEach(p => {
        csv += `${p.R},${p.V_df},${p.V_c},${p.V_cent},${p.V_tot},${p.V_ws}\n`;
      });
      return res.send(csv);
    } else if (format === "json") {
      return res.json(result);
    } else if (format === "input") {
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="dfmsph22.in"`);
      return res.send(result.cInputText);
    }
    /* Default .out format */
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="dfmsph22.out"`);
    return res.send(result.cOutputText);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default app;
