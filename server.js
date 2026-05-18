// server.js — HTTP wrapper for bazi-mcp
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

let baziModule = null;

async function getBaziModule() {
  if (baziModule) return baziModule;
  baziModule = require('bazi-mcp');
  console.log('bazi-mcp loaded, exports:', Object.keys(baziModule));
  return baziModule;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'bazi-mcp-server', time: new Date().toISOString() });
});

app.get('/tools', async (req, res) => {
  try {
    const mod = await getBaziModule();
    res.json({ tools: Object.keys(mod) });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/inspect/:tool', async (req, res) => {
  try {
    const mod = await getBaziModule();
    const fn = mod[req.params.tool];
    if (!fn) return res.status(404).json({ error: 'Tool not found' });
    res.json({ name: req.params.tool, toString: fn.toString().slice(0, 500) });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /tools/call
// Body: { tool: "getBaziDetail", params: { solarDatetime: "2026-05-18T12:00:00+08:00", gender: 1, eightCharProviderSect: 1 } }
app.post('/tools/call', async (req, res) => {
  const { tool, params } = req.body;
  if (!tool) return res.status(400).json({ error: 'tool name required' });

  try {
    const mod = await getBaziModule();
    console.log(`[bazi-server] Calling ${tool} with:`, JSON.stringify(params));

    if (typeof mod[tool] !== 'function') {
      return res.status(404).json({ error: `Tool "${tool}" not found`, available: Object.keys(mod) });
    }

    // bazi-mcp functions expect a date string directly, not an object
    // Extract the date from solarDatetime param
    let result;
    if (tool === 'getChineseCalendar') {
      // Pass solarDatetime string directly as the date param
      result = await mod[tool](params.solarDatetime);
    } else if (tool === 'getBaziDetail') {
      // getBaziDetail may take (date, gender, sect)
      result = await mod[tool](params.solarDatetime, params.gender, params.eightCharProviderSect);
    } else if (tool === 'getSolarTimes') {
      result = await mod[tool](params.solarDatetime);
    } else {
      // Generic: try passing solarDatetime first, then full params object
      try {
        result = await mod[tool](params.solarDatetime || params);
      } catch(e) {
        result = await mod[tool](params);
      }
    }

    console.log(`[bazi-server] ${tool} result:`, JSON.stringify(result).slice(0, 400));
    res.json({ success: true, result });

  } catch(e) {
    console.error(`[bazi-server] Error in ${tool}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`bazi-mcp-server running on port ${PORT}`));
