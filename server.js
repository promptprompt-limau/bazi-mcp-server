// server.js — HTTP wrapper for bazi-mcp
// Exposes bazi-mcp tools via simple REST API
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Lazy-load bazi-mcp tools
let baziTools = null;

async function getBaziTools() {
  if (baziTools) return baziTools;
  try {
    // Try different import paths for bazi-mcp
    const mod = require('bazi-mcp');
    baziTools = mod;
    console.log('bazi-mcp loaded, exports:', Object.keys(mod));
    return baziTools;
  } catch(e) {
    console.error('Failed to load bazi-mcp:', e.message);
    throw e;
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'bazi-mcp-server', time: new Date().toISOString() });
});

// ── POST /tools/call ──
// Body: { tool: "getBaziDetail", params: { solarDatetime: "...", gender: 1, eightCharProviderSect: 1 } }
app.post('/tools/call', async (req, res) => {
  const { tool, params } = req.body;
  if (!tool) return res.status(400).json({ error: 'tool name required' });

  try {
    const tools = await getBaziTools();
    console.log(`[bazi-server] Calling tool: ${tool}`, params);

    let result = null;

    // Try calling as a function directly
    if (typeof tools[tool] === 'function') {
      result = await tools[tool](params);
    } else if (tools.default && typeof tools.default[tool] === 'function') {
      result = await tools.default[tool](params);
    } else {
      // List what's available
      const available = Object.keys(tools);
      console.log('Available exports:', available);
      return res.status(404).json({ 
        error: `Tool "${tool}" not found`,
        available 
      });
    }

    console.log(`[bazi-server] ${tool} result:`, JSON.stringify(result).slice(0, 300));
    res.json({ success: true, result });

  } catch(e) {
    console.error(`[bazi-server] Error calling ${tool}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /tools ── list available tools
app.get('/tools', async (req, res) => {
  try {
    const tools = await getBaziTools();
    res.json({ tools: Object.keys(tools) });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`bazi-mcp-server running on port ${PORT}`));
