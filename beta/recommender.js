// ALLXAI beta recommender. Rule based: category + priority + volume.
// Everything a non-developer may want to change is in the three tables at
// the top (MODELS, CATEGORIES, ASSUMPTIONS).
(function (root) {
  "use strict";

  // Set to false once MODELS holds the approved model list and ratings.
  // While true, the result page tags ratings as sample values.
  var SAMPLE_DATA = true;

  // cost: approximate spend per task in rupees. accuracy: percent. scale: Low | Medium | High.
  // good: category keys this model suits, or "all".
  var MODELS = [
    { id: "a", name: "Model A", tier: "Budget",  cost: 0.20, accuracy: 82, scale: "High",   good: ["sales", "support", "content", "other"] },
    { id: "b", name: "Model B", tier: "Budget",  cost: 0.35, accuracy: 85, scale: "High",   good: ["sales", "documents", "data", "operations"] },
    { id: "c", name: "Model C", tier: "Mid",     cost: 1.20, accuracy: 90, scale: "Medium", good: ["all"] },
    { id: "d", name: "Model D", tier: "Premium", cost: 3.50, accuracy: 94, scale: "Medium", good: ["all"] },
    { id: "e", name: "Model E", tier: "Premium", cost: 6.00, accuracy: 96, scale: "Low",    good: ["documents", "data", "operations"] }
  ];

  // minutes: time a person spends per task today. workflow/url: where the result points.
  var CATEGORIES = {
    sales:      { label: "Sales and leads",        minutes: 4,  workflow: "Lead triage",            url: "app.html" },
    support:    { label: "Customer support",       minutes: 6,  workflow: "Support ticket routing", url: null },
    operations: { label: "Operations",             minutes: 5,  workflow: "Process automation",     url: null },
    content:    { label: "Content and marketing",  minutes: 20, workflow: "Content drafting",       url: null },
    documents:  { label: "Documents and finance",  minutes: 8,  workflow: "Document extraction",    url: null },
    data:       { label: "Data and reporting",     minutes: 15, workflow: "Report generation",      url: null },
    other:      { label: "Something else",         minutes: 5,  workflow: "Custom workflow",        url: null }
  };

  var VOLUMES = {
    under_1k: { label: "Under 1,000",     tasks: 500 },
    "1k_5k":  { label: "1,000 to 5,000",  tasks: 3000 },
    "5k_20k": { label: "5,000 to 20,000", tasks: 12000 },
    "20k_up": { label: "20,000+",         tasks: 30000 }
  };

  var PRIORITIES = {
    cost:     { label: "Lowest cost",  pickLabel: "Best budget pick",  escalate: 0.15 },
    balanced: { label: "Balanced",     pickLabel: "Best value pick",   escalate: 0.25 },
    quality:  { label: "Best quality", pickLabel: "Best quality pick", escalate: 0.40 }
  };

  var ASSUMPTIONS = {
    hourlyCost: 250,       // rupees per staff hour
    automationShare: 0.6,  // share of tasks the AI handles without a person
    planPrice: { user: 999, team: 3999, enterprise: 8999 }
  };

  var SCALE_RANK = { Low: 0, Medium: 1, High: 2 };

  function suitable(cat) {
    var list = MODELS.filter(function (m) { return m.good.indexOf("all") >= 0 || m.good.indexOf(cat) >= 0; });
    return list.length ? list : MODELS.slice();
  }
  function byCost(a, b) { return a.cost - b.cost; }
  function byAccuracy(a, b) { return b.accuracy - a.accuracy || a.cost - b.cost; }

  function pickPrimary(list, priority) {
    var sorted;
    if (priority === "quality") return list.slice().sort(byAccuracy)[0];
    if (priority === "balanced") {
      sorted = list.filter(function (m) { return m.accuracy >= 88; }).sort(byCost);
      if (sorted.length) return sorted[0];
    }
    return list.slice().sort(byCost)[0];
  }

  function round(n, d) { var f = Math.pow(10, d || 0); return Math.round(n * f) / f; }

  function recommend(input) {
    var cat = CATEGORIES[input.category] ? input.category : "other";
    var pri = PRIORITIES[input.priority] ? input.priority : "balanced";
    var vol = VOLUMES[input.volume] || VOLUMES["1k_5k"];
    var acct = ASSUMPTIONS.planPrice[input.accountType] ? input.accountType : "user";
    var list = suitable(cat);

    var primary = pickPrimary(list, pri);

    // Combination: a cheap first pass on every task, harder cases escalated to the strongest model.
    var first = list.slice().sort(byCost)[0];
    var second = list.slice().sort(byAccuracy).filter(function (m) { return m.id !== first.id; })[0] || first;
    var share = PRIORITIES[pri].escalate;
    var combo = {
      models: [first.name, second.name],
      accuracy: Math.round(first.accuracy * (1 - share) + second.accuracy * share),
      scale: SCALE_RANK[first.scale] <= SCALE_RANK[second.scale] ? first.scale : second.scale,
      cost: round(first.cost + share * second.cost, 2),
      escalatePercent: Math.round(share * 100)
    };

    // Estimates, based on the primary pick.
    var tasks = vol.tasks;
    var hours = tasks * CATEGORIES[cat].minutes * ASSUMPTIONS.automationShare / 60;
    var aiCost = tasks * primary.cost;
    var saved = Math.max(0, hours * ASSUMPTIONS.hourlyCost - aiCost);
    var spend = aiCost + ASSUMPTIONS.planPrice[acct];
    var roi = spend > 0 ? saved / spend : 0;

    return {
      version: 1,
      sample: SAMPLE_DATA,
      category: cat,
      priority: pri,
      primary: {
        label: PRIORITIES[pri].pickLabel,
        model: primary.name, tier: primary.tier,
        accuracy: primary.accuracy, scale: primary.scale, cost: primary.cost
      },
      combo: combo,
      workflow: { name: CATEGORIES[cat].workflow, url: CATEGORIES[cat].url },
      estimates: {
        budgetSaved: Math.round(saved / 100) * 100,
        roi: round(roi, 1),
        hoursSaved: Math.round(hours),
        tasksPerMonth: tasks
      }
    };
  }

  var api = {
    recommend: recommend, MODELS: MODELS, CATEGORIES: CATEGORIES,
    VOLUMES: VOLUMES, PRIORITIES: PRIORITIES, ASSUMPTIONS: ASSUMPTIONS
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AXRec = api;
})(this);
