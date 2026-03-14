const fs = require("fs");
const path = "C:/Users/User/OneDrive/Desktop/kaisen/backend/server/services/aiService.js";
let c = fs.readFileSync(path, "utf8");

// Fix 1: getSalesQtyByProduct — quitar estado_entrega, usar v.fecha
c = c.replace(
  ,
  
);

// Fix 2: getSalesSeriesBundle
c = c.replace(
  ,
  
);

// Fix 3: anomalies — dailyTotals call
c = c.replace(
  ,
  
);

// Fix 4: forecastDetail
c = c.replace(
  ,
  
);

fs.writeFileSync(path, c, "utf8");
// Verify
const matches = (c.match(/estado_entrega = 'entregado'/g) || []).length;
const coalesceMatches = (c.match(/COALESCE\(v\.fecha_entrega/g) || []).length;
console.log("estado_entrega filters remaining:", matches);
console.log("COALESCE fecha_entrega remaining:", coalesceMatches);
console.log("Done. File size:", c.length);