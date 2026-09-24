// Shared header for the beta pages. Needs data.js loaded first.
(function () {
  "use strict";

  var TYPE_LABEL = { user: "Users", team: "Team", enterprise: "Enterprise" };

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }

  function header(session) {
    var bar = el("header", { "class": "top" });
    var brand = el("a", { "class": "brand", href: "index.html" });
    brand.append("ALL", el("span", { "class": "x" }, "×"), "AI");
    bar.appendChild(brand);

    var nav = el("nav", { "class": "beta-nav", "aria-label": "Beta" });
    [["businesses.html", "Businesses"], ["request.html", "New request"], ["plans.html", "Plans"]].forEach(function (l) {
      var a = el("a", { href: l[0] }, l[1]);
      if (location.pathname.split("/").pop() === l[0]) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    bar.appendChild(nav);

    var who = el("div", { "class": "who" });
    if (!session) {
      who.appendChild(el("a", { "class": "linkbtn", href: "login.html" }, "Sign in"));
      var join = el("a", { "class": "btn", href: "login.html?mode=signup" }, "Create account");
      join.style.padding = "8px 14px"; join.style.fontSize = "13.5px";
      who.appendChild(join);
      bar.appendChild(who);
      document.body.prepend(bar);
      return;
    }
    var type = TYPE_LABEL[session.profile.account_type] || "Users";
    who.appendChild(el("span", { "class": "pill" }, "ALL×AI = " + type));
    who.appendChild(el("span", null, session.profile.business_name || session.user.email));
    var demo = el("a", { "class": "linkbtn", href: "app.html" }, "Demo dashboard");
    who.appendChild(demo);
    var out = el("button", { "class": "linkbtn", type: "button" }, "Sign out");
    out.addEventListener("click", function () {
      window.AX.signOut().then(function () { location.href = "login.html"; });
    });
    who.appendChild(out);
    bar.appendChild(who);

    document.body.prepend(bar);
    if (!window.AX.live) {
      document.body.prepend(el("div", { "class": "preview-bar" },
        "Local preview mode: accounts and requests are stored in this browser only."));
    }
  }

  function fmtINR(n) {
    return "₹" + Math.round(n).toLocaleString("en-IN");
  }

  window.AXUI = { header: header, el: el, fmtINR: fmtINR, TYPE_LABEL: TYPE_LABEL };
})();
