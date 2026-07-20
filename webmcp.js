// Trovai · webmcp.js
// WebMCP: stelt de kern-acties van trovai.nl beschikbaar aan AI-agents in de
// browser via navigator.modelContext (https://webmachinelearning.github.io/webmcp/).
// Feature-detected: in browsers zonder WebMCP doet dit script niets.
// Prijzen blijven altijd in de bronvaluta (EUR of USD) — nooit omrekenen.
(function () {
  "use strict";
  var mc = typeof navigator !== "undefined" ? navigator.modelContext : null;
  if (!mc) return;

  function textResult(data) {
    return {
      content: [
        { type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }
      ]
    };
  }

  async function postJson(url, body) {
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  var tools = [
    {
      name: "search_cote_dazur_listings",
      description:
        "Search Trovai's curated luxury listings on the Côte d'Azur (from €800,000). " +
        "Returns name, price in source currency, city, key specs and the canonical " +
        "trovai.nl detail URL per listing. Never convert prices to another currency.",
      inputSchema: {
        type: "object",
        properties: {
          property_type: {
            type: "string",
            enum: ["villa", "apartment", "estate", "open"],
            description: "Property type; use 'open' for all types"
          },
          budget: {
            type: "string",
            description: "Indicative budget as euro string, e.g. '€ 1.500.000' or '€ 3.000.000+'"
          },
          area: {
            type: "string",
            enum: ["nice", "cannes", "monaco", "hinterland"],
            description: "Optional sub-area"
          }
        }
      },
      execute: async function (args) {
        args = args || {};
        var data = await postJson("/api/get-listings", {
          property_type: args.property_type || "open",
          budget: args.budget || "€ 1.500.000",
          area: args.area
        });
        return textResult(data);
      }
    },
    {
      name: "search_curacao_listings",
      description:
        "Search Trovai's curated luxury listings on Curaçao (from €/USD 400,000). " +
        "Prices are returned in the source currency (EUR or USD) — present them exactly as returned.",
      inputSchema: {
        type: "object",
        properties: {
          property_type: {
            type: "string",
            enum: ["villa", "apartment", "invest", "bungalow", "estate", "open"],
            description: "Property type; use 'open' for all types"
          },
          budget: {
            type: "string",
            description: "Indicative budget as euro string, e.g. '€ 1.000.000'"
          }
        }
      },
      execute: async function (args) {
        args = args || {};
        var data = await postJson("/api/get-curacao-listings", {
          property_type: args.property_type || "open",
          budget: args.budget || "€ 1.000.000"
        });
        return textResult(data);
      }
    },
    {
      name: "get_listing_details",
      description:
        "Fetch full details for one Trovai listing. Use the listing id from search results: " +
        "numeric ids are Côte d'Azur, ids prefixed with 'cur-' are Curaçao. " +
        "The canonical page is https://trovai.nl/listing/{id}.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Listing id, e.g. '3599130' (Côte d'Azur) or 'cur-1433459' (Curaçao)"
          }
        },
        required: ["id"]
      },
      execute: async function (args) {
        var id = String((args && args.id) || "");
        var isCur = id.indexOf("cur-") === 0;
        var endpoint = isCur
          ? "/api/get-curacao-listing?id=" + encodeURIComponent(id.slice(4))
          : "/api/get-listing?id=" + encodeURIComponent(id);
        var res = await fetch(endpoint);
        if (!res.ok) throw new Error("HTTP " + res.status);
        var data = await res.json();
        return textResult(data);
      }
    }
  ];

  try {
    if (typeof mc.registerTool === "function") {
      tools.forEach(function (t) { mc.registerTool(t); });
    } else if (typeof mc.provideContext === "function") {
      mc.provideContext({ tools: tools });
    }
  } catch (e) {
    // WebMCP is experimenteel — registratiefouten mogen de site nooit raken.
  }
})();
