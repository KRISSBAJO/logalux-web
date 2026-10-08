/*
 * LogaLuxe booking button for a business's own website.
 *
 *   <script src="https://<site>/embed.js" data-business="<slug>" async></script>
 *
 * Puts a "Book now" button where the script tag sits. A click opens the business's booking page
 * in a window over the page. Optional: data-label="Book with us" (the button's words) and
 * data-color="#7A1F2B" (the button's colour). It can be included more than once on a page.
 * The only global it adds is window.LogaLuxeEmbed ({ open(slug, origin), close() }).
 */
(function () {
  "use strict";
  var NS = "LogaLuxeEmbed";
  var doc = document;
  var api = window[NS];

  if (!api || !api._mount) {
    api = window[NS] = (function () {
      var open = null; // { overlay, opener, overflow, origin, frame }

      function css(el, styles) { for (var k in styles) el.style[k] = styles[k]; return el; }

      function close() {
        if (!open) return;
        var was = open;
        open = null;
        doc.removeEventListener("keydown", onKey, true);
        window.removeEventListener("message", onMessage);
        if (was.overlay.parentNode) was.overlay.parentNode.removeChild(was.overlay);
        doc.documentElement.style.overflow = was.overflow;
        // Back to where the visitor was.
        if (was.opener && typeof was.opener.focus === "function") { try { was.opener.focus(); } catch (e) {} }
      }

      function onKey(e) { if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); close(); } }

      // Keys pressed inside the frame never reach this page, so the booking page tells us about Escape itself.
      function onMessage(e) {
        if (!open || e.origin !== open.origin || e.source !== open.frame.contentWindow) return;
        if (e.data && e.data.type === "logaluxe:close") close();
      }

      function show(slug, origin, opener) {
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(String(slug || ""))) return;
        close();
        var small = window.innerWidth < 480;

        var overlay = css(doc.createElement("div"), {
          position: "fixed", top: "0", left: "0", right: "0", bottom: "0", zIndex: "2147483000", background: "rgba(18,14,13,.6)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: small ? "0" : "12px", boxSizing: "border-box",
        });
        var box = css(doc.createElement("div"), {
          position: "relative", display: "flex", flexDirection: "column", boxSizing: "border-box", background: "#FBF7F2", overflow: "hidden",
          width: small ? "100%" : "min(420px, 100%)", height: small ? "100%" : "min(760px, 100%)", borderRadius: small ? "0" : "16px", boxShadow: "0 24px 64px rgba(0,0,0,.35)",
        });
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-modal", "true");
        box.setAttribute("aria-label", "Book online");

        var bar = css(doc.createElement("div"), { display: "flex", justifyContent: "flex-end", flex: "none", background: "#FBF7F2", borderBottom: "1px solid #E6DCD2" });
        var x = css(doc.createElement("button"), {
          width: "44px", height: "44px", border: "0", margin: "0", padding: "0", background: "transparent", color: "#1A1513", cursor: "pointer",
          font: "400 26px/1 system-ui, sans-serif",
        });
        x.type = "button";
        x.setAttribute("aria-label", "Close booking");
        x.textContent = "×";
        x.addEventListener("click", close);
        bar.appendChild(x);

        var frame = css(doc.createElement("iframe"), { flex: "1 1 auto", width: "100%", minHeight: "0", border: "0", display: "block", background: "#FBF7F2" });
        frame.title = "Book online";
        frame.src = origin + "/embed/" + encodeURIComponent(slug);

        // Tabbing past either end of the window comes back into it, not to the page behind.
        function guard(to) {
          var g = css(doc.createElement("div"), { position: "absolute", width: "1px", height: "1px", overflow: "hidden" });
          g.tabIndex = 0;
          g.setAttribute("aria-hidden", "true");
          g.addEventListener("focus", function () { try { to.focus(); } catch (e) {} });
          return g;
        }
        box.appendChild(guard(frame));
        box.appendChild(bar);
        box.appendChild(frame);
        box.appendChild(guard(x));
        overlay.appendChild(box);
        // A click on the dark surround closes it; a click inside does not.
        overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });

        open = { overlay: overlay, opener: opener || doc.activeElement, overflow: doc.documentElement.style.overflow, origin: origin, frame: frame };
        doc.documentElement.style.overflow = "hidden";
        doc.body.appendChild(overlay);
        doc.addEventListener("keydown", onKey, true);
        window.addEventListener("message", onMessage);
        try { x.focus(); } catch (e) {}
      }

      // One button per script tag, placed straight after it.
      function mount(script) {
        if (!script || script.getAttribute("data-logaluxe-ready")) return;
        var slug = (script.getAttribute("data-business") || "").trim();
        if (!slug) return;
        script.setAttribute("data-logaluxe-ready", "1");
        var origin;
        try { origin = new URL(script.src, doc.baseURI).origin; } catch (e) { return; }

        var b = css(doc.createElement("button"), {
          display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "46px", padding: "0 20px", border: "0", borderRadius: "999px",
          background: "#1A1513", color: "#FBF7F2", font: "600 15px/1 system-ui, -apple-system, 'Segoe UI', sans-serif", cursor: "pointer",
        });
        b.type = "button";
        b.textContent = (script.getAttribute("data-label") || "").trim() || "Book now";
        var colour = (script.getAttribute("data-color") || "").trim();
        if (colour) {
          // The browser decides whether it is a colour: a value it does not understand leaves the default.
          b.style.background = colour;
          var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour);
          if (hex) {
            var h = hex[1].length === 3 ? hex[1].replace(/./g, "$&$&") : hex[1];
            var light = (parseInt(h.slice(0, 2), 16) * 299 + parseInt(h.slice(2, 4), 16) * 587 + parseInt(h.slice(4, 6), 16) * 114) / 1000;
            b.style.color = light > 150 ? "#1A1513" : "#FFFFFF";
          }
        }
        b.setAttribute("aria-haspopup", "dialog");
        b.addEventListener("click", function () { show(slug, origin, b); });
        if (script.parentNode) script.parentNode.insertBefore(b, script.nextSibling);
      }

      function mountAll() {
        var all = doc.querySelectorAll("script[data-business][src]");
        for (var i = 0; i < all.length; i++) if (/\/embed\.js(\?|#|$)/.test(all[i].getAttribute("src") || "")) mount(all[i]);
      }

      return {
        /** Opens a business's booking page over the current page. `origin` is the LogaLuxe site it lives on. */
        open: function (slug, origin) { show(slug, origin || api._origin, null); },
        close: close,
        _mount: mount, _mountAll: mountAll, _origin: "",
      };
    })();
  }

  var me = doc.currentScript;
  if (me && me.src) { try { api._origin = api._origin || new URL(me.src, doc.baseURI).origin; } catch (e) {} }
  function go() { if (me) api._mount(me); api._mountAll(); }
  // The body must exist before a button can be opened over it; the button itself only needs its script tag.
  go();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", go);
})();
